const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { boundedInteger } = require('../utils/validation');

const router = express.Router();

const sendPushNotification = async (userId, title, message, link) => {
  const devices = await db.prepare(`
    SELECT expo_push_token FROM push_devices WHERE user_id = ? AND enabled = 1
  `).all(userId);
  if (!devices.length) return;

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(devices.map((device) => ({
      to: device.expo_push_token,
      title,
      body: message,
      sound: 'default',
      data: { link: link || '/notifications' }
    })))
  });
  if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
};

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { unread_only = false } = req.query;
    const limit = boundedInteger(req.query.limit, { min: 1, max: 100, fallback: 50 });
    const offset = boundedInteger(req.query.offset, { min: 0, max: 10000, fallback: 0 });

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = ?
      ${unread_only === 'true' ? 'AND is_read = 0' : ''}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const notifications = await db.prepare(query).all(userId, limit, offset);
    
    const unreadCount = await db.prepare(
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
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId);
    
    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await db.prepare(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
    ).get(id, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await db.prepare('DELETE FROM notifications WHERE id = ?').run(id);

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/clear/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.prepare('DELETE FROM notifications WHERE user_id = ? AND is_read = 1').run(userId);
    res.json({ message: 'Read notifications cleared' });
  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Helper function to create notifications (exported for use in other routes)
const createNotification = async (userId, type, title, message, link = null, relatedId = null) => {
  try {
    const stmt = await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link, related_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = await stmt.run(userId, type, title, message, link, relatedId);
    sendPushNotification(userId, title, message, link).catch((error) => {
      console.error('Push notification delivery error:', error.message);
    });
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

module.exports = router;
module.exports.createNotification = createNotification;
