const express = require('express');
const { Webhook } = require('svix');
const db = require('../db/database');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Email webhook is not configured' });
  try {
    const payload = req.body.toString('utf8');
    const event = new Webhook(secret).verify(payload, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature']
    });
    const eventId = req.headers['svix-id'];
    const providerEmailId = event.data?.email_id || event.data?.id || null;
    await db.prepare(`
      INSERT INTO email_delivery_events (provider_event_id, provider_email_id, event_type, payload)
      VALUES (?, ?, ?, ?) ON CONFLICT(provider_event_id) DO NOTHING
    `).run(eventId, providerEmailId, event.type, payload);

    const statusByEvent = {
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'complained',
      'email.failed': 'failed',
      'email.suppressed': 'suppressed'
    };
    if (providerEmailId && statusByEvent[event.type]) {
      await db.prepare(`UPDATE email_outbox SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE provider_id = ?`)
        .run(statusByEvent[event.type], providerEmailId);
    }
    res.json({ received: true });
  } catch (error) {
    console.warn('Rejected Resend webhook:', error.message);
    res.status(400).json({ error: 'Invalid webhook signature' });
  }
});

module.exports = router;
