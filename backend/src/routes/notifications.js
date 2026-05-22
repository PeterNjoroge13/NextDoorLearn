const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all notifications for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
      ${unread_only === 'true' ? 'AND is_read = 0' : ''}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const notifications = db.prepare(query).all(userId, parseInt(limit), parseInt(offset));
    
    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId);

    res.json({
      notifications,
      unreadCount: unreadCount.count
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread count only
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId);
    
    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/clear/read', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    db.prepare('DELETE FROM notifications WHERE user_id = ? AND is_read = 1').run(userId);
    res.json({ message: 'Read notifications cleared' });
  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Helper function to create notifications (exported for use in other routes)
const createNotification = (userId, type, title, message, link = null, relatedId = null) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(userId, type, title, message, link, relatedId);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

module.exports = router;
module.exports.createNotification = createNotification;
