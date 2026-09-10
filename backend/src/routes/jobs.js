const express = require('express');
const { processEmailOutbox } = require('../services/email');
const { processSessionReminders } = require('../services/reminders');

const router = express.Router();

router.post('/process', async (req, res) => {
  const configuredSecret = process.env.JOB_SECRET;
  if (process.env.NODE_ENV === 'production' && !configuredSecret) {
    return res.status(503).json({ error: 'Background jobs are not configured' });
  }
  if (configuredSecret && req.headers['x-job-secret'] !== configuredSecret) {
    return res.status(401).json({ error: 'Invalid job credentials' });
  }
  try {
    const reminders = await processSessionReminders();
    const emails = await processEmailOutbox();
    res.json({ reminders, emailsProcessed: emails.length, emailsSent: emails.filter((item) => item.status === 'sent').length });
  } catch (error) {
    console.error('Background job processing error:', error);
    res.status(500).json({ error: 'Background processing failed' });
  }
});

module.exports = router;
