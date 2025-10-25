const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Send message
router.post('/send', authenticateToken, (req, res) => {
  try {
    const { connectionId, content } = req.body;
    const senderId = req.user.userId;

    if (!connectionId || !content) {
      return res.status(400).json({ error: 'Connection ID and content are required' });
    }

    // Verify user is part of this connection
    const connection = db.prepare(`
      SELECT id FROM connections 
      WHERE id = ? AND (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(connectionId, senderId, senderId);

    if (!connection) {
      return res.status(403).json({ error: 'You are not authorized to send messages in this connection' });
    }

    // Insert message
    const insertMessage = db.prepare(`
      INSERT INTO messages (connection_id, sender_id, content)
      VALUES (?, ?, ?)
    `);
    
    const result = insertMessage.run(connectionId, senderId, content);
    
    res.status(201).json({
      message: 'Message sent successfully',
      messageId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages for a connection
router.get('/:connectionId', authenticateToken, (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.userId;

    // Verify user is part of this connection
    const connection = db.prepare(`
      SELECT id FROM connections 
      WHERE id = ? AND (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(connectionId, userId, userId);

    if (!connection) {
      return res.status(403).json({ error: 'You are not authorized to view messages in this connection' });
    }

    // Get messages with read status
    const messages = db.prepare(`
      SELECT m.id, m.content, m.timestamp, m.read_at, m.sender_id, u.name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.connection_id = ?
      ORDER BY m.timestamp ASC
    `).all(connectionId);

    // Mark messages as read for the current user (except their own messages)
    const markAsRead = db.prepare(`
      UPDATE messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE connection_id = ? AND sender_id != ? AND read_at IS NULL
    `);
    markAsRead.run(connectionId, userId);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all conversations for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    let conversations;

    if (req.user.role === 'student') {
      conversations = db.prepare(`
        SELECT c.id as connection_id, u.name as tutor_name, u.bio as tutor_bio,
               (SELECT content FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM connections c
        JOIN users u ON c.tutor_id = u.id
        WHERE c.student_id = ? AND c.status = 'accepted'
        ORDER BY last_message_time DESC
      `).all(userId);
    } else {
      conversations = db.prepare(`
        SELECT c.id as connection_id, u.name as student_name, u.bio as student_bio,
               (SELECT content FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
               (SELECT timestamp FROM messages WHERE connection_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message_time
        FROM connections c
        JOIN users u ON c.student_id = u.id
        WHERE c.tutor_id = ? AND c.status = 'accepted'
        ORDER BY last_message_time DESC
      `).all(userId);
    }

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get message statistics for a user
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get total messages sent by this user
    const messagesSent = db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE sender_id = ?
    `).get(userId);
    
    // Get total connections for this user
    const connections = db.prepare(`
      SELECT COUNT(*) as count FROM connections 
      WHERE (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(userId, userId);
    
    // Get total students helped (for tutors) or tutors connected (for students)
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    let peopleHelped = 0;
    
    if (user.role === 'tutor') {
      peopleHelped = db.prepare(`
        SELECT COUNT(DISTINCT student_id) as count FROM connections 
        WHERE tutor_id = ? AND status = 'accepted'
      `).get(userId);
    } else {
      peopleHelped = db.prepare(`
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

module.exports = router;
