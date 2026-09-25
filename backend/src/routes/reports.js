const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isPositiveInteger, isValidEmail, sanitizeText } = require('../utils/validation');
const { queueEmail } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const reportedUserId = req.body.reportedUserId;
    const reason = sanitizeText(req.body.reason, 120);
    const details = sanitizeText(req.body.details, 2000);

    if (!isPositiveInteger(reportedUserId) || !reason) {
      return res.status(400).json({ error: 'Reported user and reason are required' });
    }

    if (Number(reportedUserId) === Number(reporterId)) {
      return res.status(400).json({ error: 'You cannot report your own account' });
    }

    const reportedUser = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ error: 'Reported user not found' });
    }

    const duplicate = await db.prepare(`
      SELECT id FROM user_reports
      WHERE reporter_id = ? AND reported_user_id = ? AND status IN ('open', 'reviewing')
        AND created_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).get(reporterId, reportedUserId);
    if (duplicate) return res.status(409).json({ error: 'You already submitted a recent report about this user' });

    const result = await db.prepare(`
      INSERT INTO user_reports (reporter_id, reported_user_id, reason, details)
      VALUES (?, ?, ?, ?)
    `).run(reporterId, reportedUserId, reason, details);

    const reportId = Number(result.lastInsertRowid);
    const reporter = await db.prepare('SELECT name, email FROM users WHERE id = ?').get(reporterId);
    const adminUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin`;
    const content = emailTemplates.safetyReportAdminAlert({
      reporterName: reporter?.name || 'A NextDoorLearn user',
      reporterEmail: reporter?.email || 'unknown',
      reportedName: reportedUser.name || 'A NextDoorLearn user',
      reportedEmail: reportedUser.email || 'unknown',
      reason,
      url: adminUrl
    });
    const adminEmails = [...new Set((process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(isValidEmail))];
    await Promise.all(adminEmails.map((adminEmail) => queueEmail({
      to: adminEmail,
      template: 'safety_report_admin_alert',
      subject: 'New NextDoorLearn safety report',
      ...content,
      idempotencyKey: `safety_report_admin_alert_${reportId}_${adminEmail}`
    })));

    res.status(201).json({
      message: 'Report submitted',
      reportId
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
