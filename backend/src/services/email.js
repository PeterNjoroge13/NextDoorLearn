const db = require('../db/database');
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 8;

const providerConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const claimOutboxEmail = async (id) => {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const claimed = await db.prepare(`
    UPDATE email_outbox SET status = 'processing', locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND (
      (status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP)
      OR (status = 'processing' AND locked_at <= ?)
    )
  `).run(id, staleBefore);
  if (!claimed.changes) return null;
  return db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(id);
};

const deliverOutboxEmail = async (emailOrId) => {
  const candidate = typeof emailOrId === 'object'
    ? emailOrId
    : await db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(emailOrId);
  if (!candidate || candidate.status === 'sent') return candidate;
  const email = await claimOutboxEmail(candidate.id);
  if (!email) return { ...candidate, skipped: true };
  if (!providerConfigured()) {
    await db.prepare(`
      UPDATE email_outbox SET status = 'pending', locked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(email.id);
    return { ...email, status: 'pending', queued: true, providerConfigured: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': email.idempotency_key
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: email.recipient,
        subject: email.subject,
        text: email.text_body,
        html: email.html_body
      }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Email provider returned ${response.status}`);
    await db.prepare(`
      UPDATE email_outbox SET status = 'sent', provider_id = ?, attempts = attempts + 1,
        sent_at = CURRENT_TIMESTAMP, last_error = NULL, locked_at = NULL,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(body.id || null, email.id);
    return { ...email, status: 'sent', provider_id: body.id };
  } catch (error) {
    const attempts = Number(email.attempts || 0) + 1;
    const delayMinutes = Math.min(60, 2 ** Math.min(attempts - 1, 5));
    const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    const nextStatus = attempts >= MAX_ATTEMPTS ? 'dead_letter' : 'pending';
    await db.prepare(`
      UPDATE email_outbox SET status = ?, attempts = ?, last_error = ?,
        next_attempt_at = ?, locked_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(nextStatus, attempts, String(error.message).slice(0, 500), nextAttempt, email.id);
    console.error('Email delivery failed:', error.message);
    return { ...email, status: nextStatus, attempts, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
};

const queueEmail = async ({ to, template, subject, text, html, idempotencyKey, sendNow = true }) => {
  await db.prepare(`
    INSERT INTO email_outbox (recipient, template, subject, text_body, html_body, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING
  `).run(to, template, subject, text, html, idempotencyKey);
  const email = await db.prepare('SELECT * FROM email_outbox WHERE idempotency_key = ?').get(idempotencyKey);
  return sendNow ? deliverOutboxEmail(email) : email;
};

const processEmailOutbox = async (limit = 25) => {
  const due = await db.prepare(`
    SELECT id FROM email_outbox
    WHERE (status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP AND attempts < ?)
       OR (status = 'processing' AND locked_at <= ?)
    ORDER BY created_at ASC LIMIT ?
  `).all(
    MAX_ATTEMPTS,
    new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    Math.min(Math.max(Number(limit) || 25, 1), 100)
  );
  const results = [];
  for (const email of due) results.push(await deliverOutboxEmail(email.id));
  return results;
};

const retryOutboxEmail = async (id) => {
  const result = await db.prepare(`
    UPDATE email_outbox SET status = 'pending', attempts = 0, next_attempt_at = CURRENT_TIMESTAMP,
      last_error = NULL, locked_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('dead_letter', 'pending')
  `).run(id);
  return Boolean(result.changes);
};

const sendEmail = (options) => queueEmail({
  ...options,
  template: options.template || 'transactional',
  idempotencyKey: options.idempotencyKey || `legacy_${Date.now()}_${Math.random().toString(36).slice(2)}`
});

module.exports = { deliverOutboxEmail, processEmailOutbox, providerConfigured, queueEmail, retryOutboxEmail, sendEmail };
