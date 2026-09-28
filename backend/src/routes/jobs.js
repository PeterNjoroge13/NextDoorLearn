const express = require('express');
const { processEmailOutbox } = require('../services/email');
const { processSessionReminders } = require('../services/reminders');
const { reconcileCancelledSessionPayments } = require('../services/paymentLedger');
const { completeBackgroundJobRun, startBackgroundJobRun } = require('../services/jobHealth');

const router = express.Router();

router.post('/process', async (req, res) => {
  const configuredSecret = process.env.JOB_SECRET;
  if (process.env.NODE_ENV === 'production' && !configuredSecret) {
    return res.status(503).json({ error: 'Background jobs are not configured' });
  }
  if (configuredSecret && req.headers['x-job-secret'] !== configuredSecret) {
    return res.status(401).json({ error: 'Invalid job credentials' });
  }
  const runId = await startBackgroundJobRun();
  if (!runId) return res.status(202).json({ skipped: true, reason: 'Background processing is already running' });
  try {
    const reminders = await processSessionReminders();
    const emails = await processEmailOutbox();
    const payments = await reconcileCancelledSessionPayments();
    const summary = {
      reminders,
      emailsProcessed: emails.length,
      emailsSent: emails.filter((item) => item.status === 'sent').length,
      paymentsProcessed: payments.length,
      paymentFailures: payments.filter((item) => item.status === 'resolution_failed').length
    };
    await completeBackgroundJobRun(runId, { status: 'completed', details: summary });
    res.json(summary);
  } catch (error) {
    console.error('Background job processing error:', error);
    await completeBackgroundJobRun(runId, { status: 'failed', error: error.message }).catch((healthError) => {
      console.error('Background job heartbeat error:', healthError);
    });
    res.status(500).json({ error: 'Background processing failed' });
  }
});

module.exports = router;
