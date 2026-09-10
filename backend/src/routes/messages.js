const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireVerifiedEmail } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { isPositiveInteger, sanitizeText } = require('../utils/validation');
const { usersAreBlocked } = require('../services/safety');

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);

// Send message
router.post('/send', async (req, res) => {
  try {
    const { connectionId, content } = req.body;
    const senderId = req.user.userId;
    const messageContent = sanitizeText(content, 2000);

    if (!isPositiveInteger(connectionId) || !messageContent) {
      return res.status(400).json({ error: 'Connection ID and content are required' });
    }

    // Verify user is part of this connection and get recipient info
    const connection = await db.prepare(`
      SELECT c.id, c.student_id, c.tutor_id,
             s.name as student_name, t.name as tutor_name
      FROM connections c
      JOIN users s ON c.student_id = s.id
      JOIN users t ON c.tutor_id = t.id
      WHERE c.id = ? AND (c.student_id = ? OR c.tutor_id = ?) AND c.status = 'accepted'
    `).get(connectionId, senderId, senderId);

    if (!connection) {
      return res.status(403).json({ error: 'You are not authorized to send messages in this connection' });
    }
    if (await usersAreBlocked(connection.student_id, connection.tutor_id)) {
      return res.status(403).json({ error: 'Messaging is unavailable for this connection' });
    }

    // Insert message
    const insertMessage = await db.prepare(`
      INSERT INTO messages (connection_id, sender_id, content)
      VALUES (?, ?, ?)
    `);

    const result = await insertMessage.run(connectionId, senderId, messageContent);

    // Send notification to recipient
    const recipientId = senderId === connection.student_id ? connection.tutor_id : connection.student_id;
    const senderName = senderId === connection.student_id ? connection.student_name : connection.tutor_name;
    const preview = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;

    await createNotification(
      recipientId,
      'message',
      `New message from ${senderName}`,
      preview,
      '/messages',
      connectionId
    );

    res.status(201).json({
      message: 'Message sent successfully',
      messageId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get message statistics for a user
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get total messages sent by this user
    const messagesSent = await db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE sender_id = ?
    `).get(userId);

    // Get total connections for this user
    const connections = await db.prepare(`
      SELECT COUNT(*) as count FROM connections
      WHERE (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(userId, userId);

    // Get total students helped (for tutors) or tutors connected (for students)
    const user = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    let peopleHelped = 0;

    if (user.role === 'tutor') {
      peopleHelped = await db.prepare(`
        SELECT COUNT(DISTINCT student_id) as count FROM connections
        WHERE tutor_id = ? AND status = 'accepted'
      `).get(userId);
    } else {
      peopleHelped = await db.prepare(`
        SELECT COUNT(DISTINCT tutor_id) as count FROM connections
        WHERE student_id = ? AND status = 'accepted'
      `).get(userId);
    }

    res.json({
      messagesSent: messagesSent.count,
      activeConnections: connections.count,
      peopleHelped: peopleHelped.count
    });
  } catch (error) {
    console.error('Get message stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a connection
router.get('/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.userId;

    if (!isPositiveInteger(connectionId)) {
      return res.status(400).json({ error: 'Valid connection ID is required' });
    }

    // Verify user is part of this connection
    const connection = await db.prepare(`
      SELECT id, student_id, tutor_id FROM connections
      WHERE id = ? AND (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(connectionId, userId, userId);

    if (!connection) {
      return res.status(403).json({ error: 'You are not authorized to view messages in this connection' });
    }
    if (await usersAreBlocked(connection.student_id, connection.tutor_id)) {
      return res.status(403).json({ error: 'Messaging is unavailable for this connection' });
    }

    // Get messages with read status
    const messages = await db.prepare(`
      SELECT m.id, m.content, m.timestamp, m.read_at, m.sender_id, u.name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.connection_id = ?
      ORDER BY m.timestamp ASC
    `).all(connectionId);

    // Mark messages as read for the current user (except their own messages)
    const markAsRead = await db.prepare(`
      UPDATE messages
      SET read_at = CURRENT_TIMESTAMP
      WHERE connection_id = ? AND sender_id != ? AND read_at IS NULL
    `);
    await markAsRead.run(connectionId, userId);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all conversations for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    let conversations;

    if (req.user.role === 'student') {
      conversations = await db.prepare(`
        SELECT c.id as connection_id, u.id as other_user_id, u.name as tutor_name, u.bio as tutor_bio, u.avatar_url,
               (SELECT content FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM connections c
        JOIN users u ON c.tutor_id = u.id
        WHERE c.student_id = ? AND c.status = 'accepted'
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
            (b.blocker_id = c.student_id AND b.blocked_user_id = c.tutor_id) OR
            (b.blocker_id = c.tutor_id AND b.blocked_user_id = c.student_id))
        ORDER BY last_message_time DESC
      `).all(userId);
    } else {
      conversations = await db.prepare(`
        SELECT c.id as connection_id, u.id as other_user_id, u.name as student_name, u.bio as student_bio, u.avatar_url,
               (SELECT content FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM connections c
        JOIN users u ON c.student_id = u.id
        WHERE c.tutor_id = ? AND c.status = 'accepted'
          AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
            (b.blocker_id = c.student_id AND b.blocked_user_id = c.tutor_id) OR
            (b.blocker_id = c.tutor_id AND b.blocked_user_id = c.student_id))
        ORDER BY last_message_time DESC
      `).all(userId);
    }

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
