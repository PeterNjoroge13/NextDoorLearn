const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get connection requests for a tutor
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all pending connection requests for this tutor
    const requests = db.prepare(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        u.name as student_name,
        u.email as student_email,
        u.bio as student_bio,
        sp.grade_level,
        sp.subjects_needed
      FROM connections c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE c.tutor_id = ? AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `).all(userId);

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Respond to a connection request
router.post('/:id/respond', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user.userId;

    if (!action || !['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "accept" or "reject"' });
    }

    // Check if the request exists and belongs to this tutor
    const request = db.prepare(`
      SELECT * FROM connections 
      WHERE id = ? AND tutor_id = ? AND status = 'pending'
    `).get(id, userId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    // Update the connection status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    const updateConnection = db.prepare(`
      UPDATE connections 
      SET status = ? 
      WHERE id = ?
    `);
    
    updateConnection.run(newStatus, id);

    res.json({ 
      message: `Request ${action}ed successfully`,
      status: newStatus 
    });
  } catch (error) {
    console.error('Respond to request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all connections (accepted requests) for a tutor
router.get('/connections', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const connections = db.prepare(`
      SELECT 
        c.id,
        c.status,
        c.created_at,
        u.name as student_name,
        u.email as student_email,
        u.bio as student_bio,
        u.avatar_url as student_avatar,
        sp.grade_level,
        sp.subjects_needed
      FROM connections c
      JOIN users u ON c.student_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE c.tutor_id = ? AND c.status = 'accepted'
      ORDER BY c.created_at DESC
    `).all(userId);

    res.json(connections);
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

