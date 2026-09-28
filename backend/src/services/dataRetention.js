const db = require('../db/database');

const boundedDays = (value, fallback) => {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : fallback;
};

const cutoff = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const runDataRetention = async () => {
  const tokenCutoff = cutoff(boundedDays(process.env.RETENTION_SECURITY_TOKEN_DAYS, 30));
  const emailCutoff = cutoff(boundedDays(process.env.RETENTION_EMAIL_CONTENT_DAYS, 90));
  return db.withTransaction(async (transaction) => {
    const emailVerificationTokens = await transaction.prepare(`
      DELETE FROM email_verification_tokens WHERE expires_at < ?
    `).run(tokenCutoff);
    const passwordResetTokens = await transaction.prepare(`
      DELETE FROM password_reset_tokens WHERE expires_at < ?
    `).run(tokenCutoff);
    const refreshTokens = await transaction.prepare(`
      DELETE FROM refresh_tokens
      WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)
    `).run(tokenCutoff, tokenCutoff);
    const tutorActivationTokens = await transaction.prepare(`
      DELETE FROM tutor_activation_tokens
      WHERE expires_at < ?
        OR (used_at IS NOT NULL AND used_at < ?)
        OR (revoked_at IS NOT NULL AND revoked_at < ?)
    `).run(tokenCutoff, tokenCutoff, tokenCutoff);
    const emailContent = await transaction.prepare(`
      UPDATE email_outbox SET recipient = 'redacted@retained.nextdoorlearn.invalid',
        subject = '[Retained delivery record]', text_body = '[Expired by retention policy]',
        html_body = '[Expired by retention policy]', last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('sent', 'dead_letter') AND created_at < ?
        AND recipient <> 'redacted@retained.nextdoorlearn.invalid'
    `).run(emailCutoff);
    const emailEvents = await transaction.prepare(`
      UPDATE email_delivery_events SET payload = NULL
      WHERE created_at < ? AND payload IS NOT NULL
    `).run(emailCutoff);
    return {
      emailVerificationTokens: Number(emailVerificationTokens.changes) || 0,
      passwordResetTokens: Number(passwordResetTokens.changes) || 0,
      refreshTokens: Number(refreshTokens.changes) || 0,
      tutorActivationTokens: Number(tutorActivationTokens.changes) || 0,
      emailContentRedacted: Number(emailContent.changes) || 0,
      emailEventsRedacted: Number(emailEvents.changes) || 0
    };
  });
};

module.exports = { boundedDays, runDataRetention };
