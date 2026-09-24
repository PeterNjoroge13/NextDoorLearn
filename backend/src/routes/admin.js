const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { boundedInteger, isPositiveInteger, sanitizeText } = require('../utils/validation');
const { createSecurityToken, hashSecurityToken } = require('../utils/securityTokens');
const { queueEmail, processEmailOutbox, providerConfigured } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');
const { getTutorRecommendations, parseList } = require('../services/matching');
const { createNotification } = require('./notifications');
const { paymentsConfigured, refundPaymentIntent } = require('../services/payments');

const router = express.Router();
const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.ADMIN_SENSITIVE_ACTION_RATE_LIMIT_MAX || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sensitive administration actions. Please wait before trying again.' },
});

router.use(authenticateToken, requireAdmin);

const audit = (adminUserId, action, targetType, targetId, details = {}, database = db) => database.prepare(`
  INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details)
  VALUES (?, ?, ?, ?, ?)
`).run(adminUserId, action, targetType, targetId, JSON.stringify(details));

router.get('/overview', async (req, res) => {
  try {
    const [users, applications, reports, sessions, emails, waitlist] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) AS restricted FROM users").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN review_state IN ('submitted', 'reviewing') THEN 1 ELSE 0 END) AS awaiting_review FROM tutor_applications").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status IN ('open', 'reviewing') THEN 1 ELSE 0 END) AS open FROM user_reports").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled FROM sessions").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending FROM email_outbox").get(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open FROM student_waitlist_entries").get()
    ]);
    res.json({ users, applications, reports, sessions, emails: { ...emails, providerConfigured: providerConfigured() }, waitlist });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Unable to load administration overview' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const allowedStatuses = new Set(['pending', 'processing', 'requires_action', 'succeeded', 'failed', 'cancelled', 'refund_pending', 'refunded', 'refund_failed']);
    const status = sanitizeText(req.query.status, 40);
    const query = sanitizeText(req.query.query, 120);
    const limit = boundedInteger(req.query.limit, { min: 1, max: 100, fallback: 50 });
    const offset = boundedInteger(req.query.offset, { min: 0, max: 10000, fallback: 0 });
    if (status && !allowedStatuses.has(status)) return res.status(400).json({ error: 'Invalid payment status' });

    const clauses = [];
    const parameters = [];
    if (status) {
      clauses.push('payment.status = ?');
      parameters.push(status);
    }
    if (query) {
      clauses.push('(LOWER(student.name) LIKE ? OR LOWER(student.email) LIKE ? OR LOWER(tutor.name) LIKE ? OR LOWER(tutor.email) LIKE ? OR CAST(payment.session_id AS TEXT) LIKE ?)');
      const pattern = `%${query.toLowerCase()}%`;
      parameters.push(pattern, pattern, pattern, pattern, `%${query}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await db.prepare(`
      SELECT COUNT(*) AS total
      FROM session_payments payment
      JOIN users student ON student.id = payment.student_id
      JOIN users tutor ON tutor.id = payment.tutor_id
      ${where}
    `).get(...parameters);
    const payments = await db.prepare(`
      SELECT payment.id, payment.session_id, payment.amount_cents, payment.platform_fee_cents,
        payment.currency, payment.status, payment.failure_code, payment.failure_message,
        payment.paid_at, payment.refunded_at, payment.created_at, payment.updated_at,
        payment.provider_payment_intent_id, session.title, session.scheduled_date, session.start_time,
        student.id AS student_id, student.name AS student_name, student.email AS student_email,
        tutor.id AS tutor_id, tutor.name AS tutor_name, tutor.email AS tutor_email
      FROM session_payments payment
      JOIN sessions session ON session.id = payment.session_id
      JOIN users student ON student.id = payment.student_id
      JOIN users tutor ON tutor.id = payment.tutor_id
      ${where}
      ORDER BY payment.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset);
    const summary = await db.prepare(`
      SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_cents ELSE 0 END), 0) AS collected_cents,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN platform_fee_cents ELSE 0 END), 0) AS platform_fee_cents,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount_cents ELSE 0 END), 0) AS refunded_cents,
        SUM(CASE WHEN status IN ('failed', 'refund_failed') THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status IN ('pending', 'processing', 'requires_action', 'refund_pending') THEN 1 ELSE 0 END) AS pending
      FROM session_payments
    `).get();

    res.json({
      configured: paymentsConfigured(),
      summary,
      payments: payments.map((payment) => ({
        ...payment,
        provider_reference: payment.provider_payment_intent_id
          ? `...${payment.provider_payment_intent_id.slice(-10)}`
          : null,
        provider_payment_intent_id: undefined,
      })),
      pagination: { total: Number(count.total) || 0, limit, offset },
    });
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: 'Unable to load payment operations' });
  }
});

router.post('/payments/:id/refund', sensitiveActionLimiter, async (req, res) => {
  const paymentId = req.params.id;
  const reason = sanitizeText(req.body.reason, 1000);
  const confirmation = sanitizeText(req.body.confirmation, 20);
  if (!isPositiveInteger(paymentId)) return res.status(400).json({ error: 'Valid payment ID is required' });
  if (!reason || reason.length < 8) return res.status(400).json({ error: 'Add a refund reason of at least 8 characters' });
  if (confirmation !== 'REFUND') return res.status(400).json({ error: 'Type REFUND to confirm this action' });
  if (!paymentsConfigured()) return res.status(503).json({ error: 'Payments must be configured before issuing a refund' });

  let payment;
  try {
    payment = await db.prepare(`
      SELECT payment.*, session.title, student.name AS student_name, tutor.name AS tutor_name
      FROM session_payments payment
      JOIN sessions session ON session.id = payment.session_id
      JOIN users student ON student.id = payment.student_id
      JOIN users tutor ON tutor.id = payment.tutor_id
      WHERE payment.id = ?
    `).get(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (!payment.provider_payment_intent_id) return res.status(409).json({ error: 'This payment has no provider charge to refund' });
    if (!['succeeded', 'refund_failed'].includes(payment.status)) {
      return res.status(409).json({ error: payment.status === 'refunded' ? 'This payment has already been refunded' : 'Only completed payments can be refunded' });
    }

    const claimed = await db.prepare(`
      UPDATE session_payments SET status = 'refund_pending', failure_code = NULL,
        failure_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?
    `).run(paymentId, payment.status);
    if (!claimed.changes) return res.status(409).json({ error: 'This payment is already being updated' });

    const refund = await refundPaymentIntent(
      payment.provider_payment_intent_id,
      `nextdoorlearn-admin-refund-${payment.id}`,
      Number(payment.platform_fee_cents) > 0
    );
    const finalStatus = refund.status === 'succeeded' ? 'refunded' : 'refund_pending';
    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        UPDATE session_payments SET status = ?, refunded_at = CASE WHEN ? = 'refunded' THEN CURRENT_TIMESTAMP ELSE refunded_at END,
          failure_code = NULL, failure_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(finalStatus, finalStatus, paymentId);
      await audit(req.user.userId, 'payment.refund_requested', 'payment', paymentId, {
        sessionId: payment.session_id,
        amountCents: payment.amount_cents,
        reason,
        providerRefundId: refund.id,
        providerStatus: refund.status,
      }, transaction);
    });
    await Promise.all([
      createNotification(payment.student_id, 'payment', 'Your tutoring payment was refunded', `A $${(Number(payment.amount_cents) / 100).toFixed(2)} refund was issued for ${payment.title}.`, '/payments', payment.session_id),
      createNotification(payment.tutor_id, 'payment', 'A session payment was refunded', `The payment for ${payment.title} was refunded by platform support.`, '/payments', payment.session_id),
    ]);
    res.json({ id: payment.id, session_id: payment.session_id, status: finalStatus, refunded_at: finalStatus === 'refunded' ? new Date().toISOString() : null });
  } catch (error) {
    console.error('Admin payment refund error:', error);
    if (payment) {
      await db.withTransaction(async (transaction) => {
        await transaction.prepare(`
          UPDATE session_payments SET status = 'refund_failed', failure_code = ?,
            failure_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'refund_pending'
        `).run(sanitizeText(error.code, 80) || 'provider_error', 'The payment provider could not complete this refund.', paymentId);
        await audit(req.user.userId, 'payment.refund_failed', 'payment', paymentId, {
          sessionId: payment.session_id,
          reason,
          providerCode: sanitizeText(error.code, 80) || 'provider_error',
        }, transaction);
      }).catch((auditError) => console.error('Refund failure audit error:', auditError));
    }
    res.status(error.statusCode || 502).json({ error: error.statusCode === 503 ? error.message : 'The payment provider could not complete this refund' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, email, role, name, status, email_verified_at, verified_at, created_at, last_seen
      FROM users
      ORDER BY created_at DESC
      LIMIT 250
    `).all();
    res.json(users);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, verified } = req.body;

    if (!isPositiveInteger(userId)) {
      return res.status(400).json({ error: 'Valid user ID is required' });
    }

    if (status && !['active', 'suspended', 'banned', 'deactivated'].includes(status)) {
      return res.status(400).json({ error: 'Invalid account status' });
    }

    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (status && status !== 'active' && Number(userId) === Number(req.user.userId)) {
      return res.status(400).json({ error: 'You cannot restrict your own administrator account' });
    }

    if (status) {
      await db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    }

    if (verified !== undefined) {
      await db.prepare(`
        UPDATE users
        SET verified_at = ${verified ? 'CURRENT_TIMESTAMP' : 'NULL'}
        WHERE id = ?
      `).run(userId);
    }

    await audit(req.user.userId, 'user.updated', 'user', userId, { status, verified });

    const updated = await db.prepare(`
      SELECT id, email, role, name, status, email_verified_at, verified_at, created_at, last_seen
      FROM users WHERE id = ?
    `).get(userId);

    res.json(updated);
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await db.prepare(`
      SELECT r.*, reporter.email as reporter_email, reported.email as reported_email
      FROM user_reports r
      JOIN users reporter ON r.reporter_id = reporter.id
      JOIN users reported ON r.reported_user_id = reported.id
      ORDER BY r.created_at DESC
      LIMIT 250
    `).all();
    res.json(reports);
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const reportId = req.params.id;
    const status = sanitizeText(req.body.status, 40);

    if (!isPositiveInteger(reportId)) {
      return res.status(400).json({ error: 'Valid report ID is required' });
    }

    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status' });
    }

    await db.prepare(`
      UPDATE user_reports
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reportId);

    const report = await db.prepare('SELECT * FROM user_reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await audit(req.user.userId, 'report.status_updated', 'report', reportId, { status });

    res.json(report);
  } catch (error) {
    console.error('Admin report update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reports/:id/actions', async (req, res) => {
  try {
    const reportId = req.params.id;
    const action = sanitizeText(req.body.action, 40);
    const reason = sanitizeText(req.body.reason, 1000);
    if (!isPositiveInteger(reportId) || !['warn', 'suspend', 'ban', 'reactivate', 'dismiss'].includes(action) || !reason) {
      return res.status(400).json({ error: 'Valid report, moderation action, and reason are required' });
    }
    const report = await db.prepare('SELECT * FROM user_reports WHERE id = ?').get(reportId);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const statusByAction = { suspend: 'suspended', ban: 'banned', reactivate: 'active' };
    await db.withTransaction(async (transaction) => {
      if (statusByAction[action]) {
        await transaction.prepare('UPDATE users SET status = ? WHERE id = ?').run(statusByAction[action], report.reported_user_id);
      }
      await transaction.prepare(`
        INSERT INTO moderation_actions (report_id, subject_user_id, admin_user_id, action, reason)
        VALUES (?, ?, ?, ?, ?)
      `).run(reportId, report.reported_user_id, req.user.userId, action, reason);
      await transaction.prepare("UPDATE user_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(action === 'dismiss' ? 'dismissed' : 'resolved', reportId);
      await audit(req.user.userId, `moderation.${action}`, 'user', report.reported_user_id, { reportId, reason }, transaction);
    });
    res.json({ message: `Moderation action ${action} recorded`, action, reportStatus: action === 'dismiss' ? 'dismissed' : 'resolved' });
  } catch (error) {
    console.error('Moderation action error:', error);
    res.status(500).json({ error: 'Unable to apply moderation action' });
  }
});

router.get('/tutor-applications', async (req, res) => {
  try {
    const applications = (await db.prepare(`
      SELECT id, name, email, phone, location, profile_picture_url, subjects, education, experience,
             motivation, availability, tutoring_mode, hourly_rate, status, review_state, activation_status,
             invitation_sent_at, activated_user_id, decision_reason, internal_notes, reviewed_at, created_at, updated_at
      FROM tutor_applications ORDER BY created_at DESC LIMIT 250
    `).all()).map((application) => ({
      ...application,
      subjects: JSON.parse(application.subjects || '[]')
    }));
    res.json(applications);
  } catch (error) {
    console.error('Admin tutor applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tutor-applications/:id', async (req, res) => {
  try {
    const applicationId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    const reason = sanitizeText(req.body.reason, 1000);
    const internalNotes = sanitizeText(req.body.internalNotes, 2000);
    if (!isPositiveInteger(applicationId)) return res.status(400).json({ error: 'Valid application ID is required' });
    if (!['pending', 'reviewing', 'needs_information', 'approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid application status' });

    const application = await db.prepare('SELECT * FROM tutor_applications WHERE id = ?').get(applicationId);
    if (!application) return res.status(404).json({ error: 'Application not found' });

    if (status === 'approved') {
      if (application.activation_status === 'activated') {
        return res.status(409).json({ error: 'This tutor account is already activated' });
      }
      const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(application.email);
      if (existing && Number(existing.id) !== Number(application.activated_user_id)) {
        return res.status(409).json({ error: 'An account already exists with this applicant email' });
      }

      const rawToken = createSecurityToken();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      await db.withTransaction(async (transaction) => {
        await transaction.prepare(`
          UPDATE tutor_activation_tokens SET revoked_at = CURRENT_TIMESTAMP
          WHERE application_id = ? AND used_at IS NULL AND revoked_at IS NULL
        `).run(applicationId);
        await transaction.prepare(`
          INSERT INTO tutor_activation_tokens (application_id, token_hash, expires_at) VALUES (?, ?, ?)
        `).run(applicationId, hashSecurityToken(rawToken), expiresAt);
        await transaction.prepare(`
          UPDATE tutor_applications SET status = 'approved', review_state = 'approved', activation_status = 'invited',
            reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, decision_reason = ?, internal_notes = ?,
            invitation_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(req.user.userId, reason, internalNotes, applicationId);
        await audit(req.user.userId, 'tutor_application.approved', 'tutor_application', applicationId, { reason }, transaction);
      });

      const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate-tutor?token=${rawToken}`;
      const content = emailTemplates.tutorActivation(application.name, link);
      await queueEmail({
        to: application.email,
        template: 'tutor_activation',
        subject: 'Activate your approved NextDoorLearn tutor account',
        ...content,
        idempotencyKey: `tutor_invite_${applicationId}_${hashSecurityToken(rawToken).slice(0, 24)}`
      });
      const updated = await db.prepare('SELECT id, status, review_state, activation_status, invitation_sent_at, reviewed_at, updated_at FROM tutor_applications WHERE id = ?').get(applicationId);
      return res.json({
        ...updated,
        activation: {
          url: link,
          expiresAt,
          emailProviderConfigured: providerConfigured()
        },
        ...(process.env.NODE_ENV === 'production' ? {} : { activationToken: rawToken })
      });
    }

    const storedStatus = status === 'needs_information' ? 'reviewing' : status;
    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        UPDATE tutor_applications SET status = ?, review_state = ?, activation_status = 'not_invited',
          reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, decision_reason = ?, internal_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(storedStatus, status === 'pending' ? 'submitted' : status, req.user.userId, reason, internalNotes, applicationId);
      if (status === 'declined') {
        await transaction.prepare(`UPDATE tutor_activation_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE application_id = ? AND used_at IS NULL`).run(applicationId);
      }
      await transaction.prepare(`
        INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, details)
        VALUES (?, ?, 'tutor_application', ?, ?)
      `).run(req.user.userId, `tutor_application.${status}`, applicationId, JSON.stringify({ reason }));
    });
    if (['needs_information', 'declined'].includes(status)) {
      const content = emailTemplates.tutorApplicationDecision(
        application.name,
        status,
        reason,
        status === 'needs_information'
          ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/apply/tutor`
          : (process.env.FRONTEND_URL || 'http://localhost:5173')
      );
      await queueEmail({
        to: application.email,
        template: `tutor_application_${status}`,
        subject: status === 'needs_information' ? 'More information needed for your tutor application' : 'Update on your tutor application',
        ...content,
        idempotencyKey: `tutor_application_${status}_${applicationId}_${Date.now()}`
      });
    }
    res.json(await db.prepare('SELECT id, status, review_state, activation_status, reviewed_at, updated_at FROM tutor_applications WHERE id = ?').get(applicationId));
  } catch (error) {
    console.error('Admin tutor application update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit-log', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT a.*, u.name AS admin_name, u.email AS admin_email
      FROM admin_audit_logs a JOIN users u ON u.id = a.admin_user_id
      ORDER BY a.created_at DESC LIMIT 250
    `).all();
    res.json(rows.map((row) => ({ ...row, details: JSON.parse(row.details || '{}') })));
  } catch (error) {
    console.error('Admin audit log error:', error);
    res.status(500).json({ error: 'Unable to load audit log' });
  }
});

router.get('/email-outbox', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, recipient, template, subject, status, provider_id, attempts, next_attempt_at,
             last_error, sent_at, created_at, updated_at
      FROM email_outbox ORDER BY created_at DESC LIMIT 250
    `).all();
    res.json({ providerConfigured: providerConfigured(), emails: rows });
  } catch (error) {
    console.error('Admin email outbox error:', error);
    res.status(500).json({ error: 'Unable to load email delivery history' });
  }
});

router.post('/email-outbox/process', async (req, res) => {
  const results = await processEmailOutbox(50);
  await audit(req.user.userId, 'email_outbox.processed', 'email_outbox', null, { count: results.length });
  res.json({ processed: results.length, sent: results.filter((item) => item.status === 'sent').length });
});

router.get('/sponsor-inquiries', async (req, res) => {
  try {
    res.json(await db.prepare(`
      SELECT id, name, email, organization, sponsor_type, message, status, created_at
      FROM sponsor_inquiries ORDER BY created_at DESC LIMIT 250
    `).all());
  } catch (error) {
    console.error('Admin sponsor inquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/sponsor-inquiries/:id', async (req, res) => {
  try {
    const inquiryId = req.params.id;
    const status = sanitizeText(req.body.status, 40);
    if (!isPositiveInteger(inquiryId)) return res.status(400).json({ error: 'Valid inquiry ID is required' });
    if (!['new', 'contacted', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid inquiry status' });

    const result = await db.prepare('UPDATE sponsor_inquiries SET status = ? WHERE id = ?').run(status, inquiryId);
    if (!result.changes) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(await db.prepare('SELECT id, status FROM sponsor_inquiries WHERE id = ?').get(inquiryId));
  } catch (error) {
    console.error('Admin sponsor inquiry update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/waitlist', async (req, res) => {
  try {
    const entries = (await db.prepare(`
      SELECT w.*, u.name, u.email, tutor.name AS matched_tutor_name, tutor.email AS matched_tutor_email
      FROM student_waitlist_entries w JOIN users u ON u.id = w.student_id
      LEFT JOIN users tutor ON tutor.id = w.matched_tutor_id
      ORDER BY CASE w.status WHEN 'open' THEN 0 ELSE 1 END, w.updated_at DESC
      LIMIT 250
    `).all()).map((entry) => ({ ...entry, subjects: parseList(entry.subjects) }));
    res.json(entries);
  } catch (error) {
    console.error('Admin waitlist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/waitlist/:id/recommendations', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid waitlist entry ID is required' });
    const entry = await db.prepare('SELECT * FROM student_waitlist_entries WHERE id = ?').get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Waitlist entry not found' });
    const recommendations = await getTutorRecommendations({
      studentId: entry.student_id,
      student: {
        subjects_needed: entry.subjects,
        grade_level: entry.grade_level,
        budget_preference: entry.budget_preference,
        tutoring_mode: entry.tutoring_mode,
        preferred_schedule: entry.preferred_schedule,
      },
      limit: 8,
    });
    res.json({ recommendations });
  } catch (error) {
    console.error('Admin waitlist recommendations error:', error);
    res.status(500).json({ error: 'Unable to calculate waitlist matches' });
  }
});

router.post('/waitlist/:id/actions', async (req, res) => {
  try {
    const waitlistId = req.params.id;
    const action = sanitizeText(req.body.action, 30);
    const adminNotes = sanitizeText(req.body.adminNotes, 2000);
    if (!isPositiveInteger(waitlistId) || !['notes', 'contacted', 'match', 'reopen', 'close'].includes(action)) {
      return res.status(400).json({ error: 'Valid waitlist entry and action are required' });
    }
    const entry = await db.prepare(`
      SELECT w.*, student.name AS student_name
      FROM student_waitlist_entries w JOIN users student ON student.id = w.student_id
      WHERE w.id = ?
    `).get(waitlistId);
    if (!entry) return res.status(404).json({ error: 'Waitlist entry not found' });
    if (['contacted', 'match'].includes(action) && entry.status !== 'open') {
      return res.status(409).json({ error: 'Reopen this waitlist request before taking that action' });
    }

    let matchedTutor = null;
    if (action === 'match') {
      if (!isPositiveInteger(req.body.tutorId)) return res.status(400).json({ error: 'Choose a recommended tutor' });
      const recommendations = await getTutorRecommendations({
        studentId: entry.student_id,
        student: {
          subjects_needed: entry.subjects,
          grade_level: entry.grade_level,
          budget_preference: entry.budget_preference,
          tutoring_mode: entry.tutoring_mode,
        },
        limit: 25,
      });
      matchedTutor = recommendations.find((tutor) => Number(tutor.id) === Number(req.body.tutorId));
      if (!matchedTutor) return res.status(409).json({ error: 'That tutor is no longer available for this student' });

      await db.withTransaction(async (transaction) => {
        const existingConnection = await transaction.prepare('SELECT id, status FROM connections WHERE student_id = ? AND tutor_id = ?').get(entry.student_id, matchedTutor.id);
        if (!existingConnection) {
          await transaction.prepare("INSERT INTO connections (student_id, tutor_id, status) VALUES (?, ?, 'pending')").run(entry.student_id, matchedTutor.id);
        } else if (existingConnection.status === 'rejected') {
          await transaction.prepare("UPDATE connections SET status = 'pending', created_at = CURRENT_TIMESTAMP WHERE id = ?").run(existingConnection.id);
        }
        await transaction.prepare(`
          UPDATE student_waitlist_entries SET status = 'matched', matched_tutor_id = ?, matched_by = ?,
            matched_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(matchedTutor.id, req.user.userId, adminNotes || entry.admin_notes || null, waitlistId);
        await audit(req.user.userId, 'waitlist.matched', 'student_waitlist', waitlistId, {
          studentId: entry.student_id,
          tutorId: matchedTutor.id,
          matchScore: matchedTutor.matchScore,
        }, transaction);
      });

      await createNotification(
        matchedTutor.id,
        'waitlist_match',
        'A student may be a strong match',
        `${entry.student_name} is looking for help in ${parseList(entry.subjects).slice(0, 2).join(' and ') || 'their focus subjects'}. Review the connection request when you are ready.`,
        '/requests', waitlistId
      );
      await createNotification(
        entry.student_id,
        'waitlist_match',
        'We found a tutor match',
        `${matchedTutor.name} has been invited to review your tutoring request.`,
        '/tutors', matchedTutor.id
      );
    } else {
      const updates = {
        notes: 'admin_notes = ?, updated_at = CURRENT_TIMESTAMP',
        contacted: "contacted_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP",
        close: "status = 'closed', admin_notes = ?, updated_at = CURRENT_TIMESTAMP",
        reopen: "status = 'open', matched_tutor_id = NULL, matched_by = NULL, matched_at = NULL, contacted_at = NULL, admin_notes = ?, updated_at = CURRENT_TIMESTAMP",
      };
      await db.withTransaction(async (transaction) => {
        if (action === 'reopen' && entry.matched_tutor_id) {
          await transaction.prepare(`
            DELETE FROM connections
            WHERE student_id = ? AND tutor_id = ? AND status = 'pending'
          `).run(entry.student_id, entry.matched_tutor_id);
        }
        const notesValue = action === 'notes' ? (adminNotes || null) : (adminNotes || entry.admin_notes || null);
        await transaction.prepare(`UPDATE student_waitlist_entries SET ${updates[action]} WHERE id = ?`)
          .run(notesValue, waitlistId);
        await audit(req.user.userId, `waitlist.${action}`, 'student_waitlist', waitlistId, { studentId: entry.student_id }, transaction);
      });
    }

    const updated = await db.prepare(`
      SELECT w.*, tutor.name AS matched_tutor_name, tutor.email AS matched_tutor_email
      FROM student_waitlist_entries w LEFT JOIN users tutor ON tutor.id = w.matched_tutor_id
      WHERE w.id = ?
    `).get(waitlistId);
    res.json({ ...updated, subjects: parseList(updated.subjects) });
  } catch (error) {
    console.error('Admin waitlist action error:', error);
    res.status(500).json({ error: 'Unable to update waitlist entry' });
  }
});

module.exports = router;
