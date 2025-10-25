const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all sessions for a user (tutor or student)
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, month, year } = req.query;
    
    let query = `
      SELECT 
        s.*,
        u1.name as tutor_name,
        u1.email as tutor_email,
        u2.name as student_name,
        u2.email as student_email,
        c.status as connection_status
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      JOIN connections c ON s.connection_id = c.id
      WHERE (s.tutor_id = ? OR s.student_id = ?)
    `;
    
    const params = [userId, userId];
    
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    
    if (month && year) {
      query += ' AND strftime(\'%m\', s.scheduled_date) = ? AND strftime(\'%Y\', s.scheduled_date) = ?';
      params.push(month.toString().padStart(2, '0'), year.toString());
    }
    
    query += ' ORDER BY s.scheduled_date DESC, s.start_time DESC';
    
    const sessions = db.prepare(query).all(...params);
    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get upcoming sessions for a user
router.get('/upcoming', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;
    
    const sessions = db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE (s.tutor_id = ? OR s.student_id = ?)
        AND s.status = 'scheduled'
        AND (s.scheduled_date > date('now') OR (s.scheduled_date = date('now') AND s.start_time > time('now')))
      ORDER BY s.scheduled_date ASC, s.start_time ASC
      LIMIT ?
    `).all(userId, userId, parseInt(limit));
    
    res.json(sessions);
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new session
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      connectionId,
      title,
      description,
      subject,
      scheduledDate,
      startTime,
      endTime,
      meetingLink
    } = req.body;
    
    const userId = req.user.userId;
    
    // Validate required fields
    if (!connectionId || !title || !scheduledDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify the connection exists and user is part of it
    const connection = db.prepare(`
      SELECT * FROM connections 
      WHERE id = ? AND (student_id = ? OR tutor_id = ?) AND status = 'accepted'
    `).get(connectionId, userId, userId);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found or not accepted' });
    }
    
    // Calculate duration
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const durationMinutes = Math.round((end - start) / (1000 * 60));
    
    if (durationMinutes <= 0) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    
    // Check for time conflicts
    const conflicts = db.prepare(`
      SELECT id FROM sessions 
      WHERE (tutor_id = ? OR student_id = ?) 
        AND scheduled_date = ? 
        AND status = 'scheduled'
        AND (
          (start_time <= ? AND end_time > ?) OR
          (start_time < ? AND end_time >= ?) OR
          (start_time >= ? AND end_time <= ?)
        )
    `).all(
      connection.tutor_id,
      connection.student_id,
      scheduledDate,
      startTime, startTime,
      endTime, endTime,
      startTime, endTime
    );
    
    if (conflicts.length > 0) {
      return res.status(400).json({ error: 'Time conflict: Another session is scheduled at this time' });
    }
    
    // Create the session
    const insertSession = db.prepare(`
      INSERT INTO sessions (
        connection_id, tutor_id, student_id, title, description, subject,
        scheduled_date, start_time, end_time, duration_minutes, meeting_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertSession.run(
      connectionId,
      connection.tutor_id,
      connection.student_id,
      title,
      description || '',
      subject || '',
      scheduledDate,
      startTime,
      endTime,
      durationMinutes,
      meetingLink || ''
    );
    
    // Get the created session with user details
    const newSession = db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(newSession);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session status
router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const sessionId = req.params.id;
    const { status, notes } = req.body;
    const userId = req.user.userId;
    
    if (!['scheduled', 'completed', 'cancelled', 'no_show'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Verify user can update this session
    const session = db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND (tutor_id = ? OR student_id = ?)
    `).get(sessionId, userId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Update session
    const updateSession = db.prepare(`
      UPDATE sessions 
      SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    updateSession.run(status, notes || session.notes, sessionId);
    
    // Get updated session
    const updatedSession = db.prepare(`
      SELECT 
        s.*,
        u1.name as tutor_name,
        u2.name as student_name
      FROM sessions s
      JOIN users u1 ON s.tutor_id = u1.id
      JOIN users u2 ON s.student_id = u2.id
      WHERE s.id = ?
    `).get(sessionId);
    
    res.json(updatedSession);
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a session
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user.userId;
    
    // Verify user can delete this session
    const session = db.prepare(`
      SELECT * FROM sessions 
      WHERE id = ? AND (tutor_id = ? OR student_id = ?)
    `).get(sessionId, userId, userId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only allow deletion of scheduled sessions
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Only scheduled sessions can be deleted' });
    }
    
    // Delete session
    const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');
    deleteSession.run(sessionId);
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session statistics
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_sessions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_sessions,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show_sessions,
        SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END) as total_minutes_taught
      FROM sessions 
      WHERE tutor_id = ? OR student_id = ?
    `).get(userId, userId);
    
    res.json(stats);
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
