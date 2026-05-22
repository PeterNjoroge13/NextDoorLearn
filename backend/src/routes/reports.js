const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isPositiveInteger, sanitizeText } = require('../utils/validation');

const router = express.Router();

router.post('/', authenticateToken, (req, res) => {
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

    const reportedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ error: 'Reported user not found' });
    }

    const result = db.prepare(`
      INSERT INTO user_reports (reporter_id, reported_user_id, reason, details)
      VALUES (?, ?, ?, ?)
    `).run(reporterId, reportedUserId, reason, details);

    res.status(201).json({
      message: 'Report submitted',
      reportId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
