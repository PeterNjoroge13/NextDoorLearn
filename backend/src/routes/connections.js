const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Send connection request
router.post('/request', authenticateToken, (req, res) => {
  try {
    const studentId = req.user.userId;
    const { tutorId } = req.body;

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can send connection requests' });
    }

    if (!tutorId) {
      return res.status(400).json({ error: 'Tutor ID is required' });
    }

    // Check if tutor exists
    const tutor = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(tutorId, 'tutor');
    if (!tutor) {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    // Check if connection already exists
    const existingConnection = db.prepare(`
      SELECT id FROM connections 
      WHERE student_id = ? AND tutor_id = ?
    `).get(studentId, tutorId);

    if (existingConnection) {
      return res.status(400).json({ error: 'Connection request already exists' });
    }

    // Create connection request
    const insertConnection = db.prepare(`
      INSERT INTO connections (student_id, tutor_id, status)
      VALUES (?, ?, 'pending')
    `);
    
    const result = insertConnection.run(studentId, tutorId);
    
    res.status(201).json({
      message: 'Connection request sent successfully',
      connectionId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Connection request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get connection requests for tutor
router.get('/requests', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'tutor') {
      return res.status(403).json({ error: 'Only tutors can view connection requests' });
    }

    const requests = db.prepare(`
      SELECT c.id, c.status, c.created_at, u.name as student_name, u.bio as student_bio
      FROM connections c
      JOIN users u ON c.student_id = u.id
      WHERE c.tutor_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.userId);

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept or reject connection request
router.put('/:connectionId/respond', authenticateToken, (req, res) => {
  try {
    const { connectionId } = req.params;
    const { status } = req.body;

    if (req.user.role !== 'tutor') {
      return res.status(403).json({ error: 'Only tutors can respond to connection requests' });
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be either accepted or rejected' });
    }

    // Check if connection exists and belongs to this tutor
    const connection = db.prepare(`
      SELECT id FROM connections 
      WHERE id = ? AND tutor_id = ? AND status = 'pending'
    `).get(connectionId, req.user.userId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection request not found or already processed' });
    }

    // Update connection status
    const updateConnection = db.prepare(`
      UPDATE connections SET status = ? WHERE id = ?
    `);
    updateConnection.run(status, connectionId);

    res.json({ message: `Connection request ${status} successfully` });
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get connections for student
router.get('/my-connections', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    let connections;

    if (req.user.role === 'student') {
      connections = db.prepare(`
        SELECT c.id, c.status, c.created_at, u.name as tutor_name, u.bio as tutor_bio
        FROM connections c
        JOIN users u ON c.tutor_id = u.id
        WHERE c.student_id = ?
        ORDER BY c.created_at DESC
      `).all(userId);
    } else {
      connections = db.prepare(`
        SELECT c.id, c.status, c.created_at, u.name as student_name, u.bio as student_bio
        FROM connections c
        JOIN users u ON c.student_id = u.id
        WHERE c.tutor_id = ? AND c.status = 'accepted'
        ORDER BY c.created_at DESC
      `).all(userId);
    }

    res.json(connections);
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
