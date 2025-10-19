const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = db.prepare('SELECT id, email, role, name, bio, created_at FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get role-specific profile
    let profile = {};
    if (user.role === 'tutor') {
      profile = db.prepare('SELECT * FROM tutor_profiles WHERE user_id = ?').get(userId);
    } else {
      profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(userId);
    }

    res.json({ ...user, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, profile } = req.body;

    // Update basic user info
    if (name || bio !== undefined) {
      const updateUser = db.prepare('UPDATE users SET name = ?, bio = ? WHERE id = ?');
      updateUser.run(name || req.user.name, bio, userId);
    }

    // Update role-specific profile
    if (profile) {
      if (req.user.role === 'tutor') {
        const { subjects, availability, hourly_rate } = profile;
        const updateTutorProfile = db.prepare(`
          UPDATE tutor_profiles 
          SET subjects = ?, availability = ?, hourly_rate = ? 
          WHERE user_id = ?
        `);
        updateTutorProfile.run(
          JSON.stringify(subjects || []),
          JSON.stringify(availability || {}),
          hourly_rate || 0,
          userId
        );
      } else {
        const { grade_level, subjects_needed } = profile;
        const updateStudentProfile = db.prepare(`
          UPDATE student_profiles 
          SET grade_level = ?, subjects_needed = ? 
          WHERE user_id = ?
        `);
        updateStudentProfile.run(
          grade_level || '',
          JSON.stringify(subjects_needed || []),
          userId
        );
      }
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tutors
router.get('/tutors', (req, res) => {
  try {
    const tutors = db.prepare(`
      SELECT u.id, u.name, u.bio, tp.subjects, tp.availability, tp.hourly_rate
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      WHERE u.role = 'tutor'
    `).all();

    // Parse JSON fields
    const formattedTutors = tutors.map(tutor => ({
      ...tutor,
      subjects: JSON.parse(tutor.subjects),
      availability: JSON.parse(tutor.availability)
    }));

    res.json(formattedTutors);
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
