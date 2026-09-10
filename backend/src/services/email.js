const db = require('../db/database');

const providerConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

const deliverOutboxEmail = async (emailOrId) => {
  const email = typeof emailOrId === 'object'
    ? emailOrId
    : await db.prepare('SELECT * FROM email_outbox WHERE id = ?').get(emailOrId);
  if (!email || email.status === 'sent') return email;
  if (!providerConfigured()) return { ...email, queued: true, providerConfigured: false };

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
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Email provider returned ${response.status}`);
    await db.prepare(`
      UPDATE email_outbox SET status = 'sent', provider_id = ?, attempts = attempts + 1,
        sent_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(body.id || null, email.id);
    return { ...email, status: 'sent', provider_id: body.id };
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.min(Number(email.attempts || 0), 5));
    const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    await db.prepare(`
      UPDATE email_outbox SET status = 'pending', attempts = attempts + 1, last_error = ?,
        next_attempt_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(String(error.message).slice(0, 500), nextAttempt, email.id);
    console.error('Email delivery failed:', error.message);
    return { ...email, status: 'pending', error: error.message };
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
    SELECT * FROM email_outbox
    WHERE status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP AND attempts < 8
    ORDER BY created_at ASC LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 25, 1), 100));
  const results = [];
  for (const email of due) results.push(await deliverOutboxEmail(email));
  return results;
};

const sendEmail = (options) => queueEmail({
  ...options,
  template: options.template || 'transactional',
  idempotencyKey: options.idempotencyKey || `legacy_${Date.now()}_${Math.random().toString(36).slice(2)}`
});

module.exports = { queueEmail, sendEmail, processEmailOutbox, providerConfigured };
