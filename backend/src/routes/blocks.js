const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isPositiveInteger, sanitizeText } = require('../utils/validation');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const blocked = await db.prepare(`
      SELECT b.id, b.blocked_user_id, b.reason, b.created_at, u.name, u.avatar_url, u.role
      FROM user_blocks b JOIN users u ON u.id = b.blocked_user_id
      WHERE b.blocker_id = ? ORDER BY b.created_at DESC
    `).all(req.user.userId);
    res.json(blocked);
  } catch (error) {
    console.error('List blocks error:', error);
    res.status(500).json({ error: 'Unable to load blocked users' });
  }
});

router.post('/:userId', async (req, res) => {
  try {
    const blockedUserId = req.params.userId;
    if (!isPositiveInteger(blockedUserId) || Number(blockedUserId) === Number(req.user.userId)) {
      return res.status(400).json({ error: 'Choose a valid user to block' });
    }
    const user = await db.prepare('SELECT id FROM users WHERE id = ?').get(blockedUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        INSERT INTO user_blocks (blocker_id, blocked_user_id, reason) VALUES (?, ?, ?)
        ON CONFLICT(blocker_id, blocked_user_id) DO UPDATE SET reason = excluded.reason
      `).run(req.user.userId, blockedUserId, sanitizeText(req.body.reason, 500));
      await transaction.prepare(`
        UPDATE connections SET status = 'rejected'
        WHERE status = 'pending' AND ((student_id = ? AND tutor_id = ?) OR (student_id = ? AND tutor_id = ?))
      `).run(req.user.userId, blockedUserId, blockedUserId, req.user.userId);
      await transaction.prepare(`
        DELETE FROM favorites
        WHERE (student_id = ? AND tutor_id = ?) OR (student_id = ? AND tutor_id = ?)
      `).run(req.user.userId, blockedUserId, blockedUserId, req.user.userId);
    });
    res.status(201).json({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Unable to block user' });
  }
});

router.delete('/:userId', async (req, res) => {
  try {
    if (!isPositiveInteger(req.params.userId)) return res.status(400).json({ error: 'Valid user ID is required' });
    await db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_user_id = ?').run(req.user.userId, req.params.userId);
    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Unable to unblock user' });
  }
});

module.exports = router;
