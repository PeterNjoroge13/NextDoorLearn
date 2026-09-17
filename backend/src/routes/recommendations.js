const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { getTutorRecommendations, normalized } = require('../services/matching');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const student = await db.prepare(`
      SELECT grade_level, subjects_needed, preferred_schedule, learning_style, budget_preference, tutoring_mode
      FROM student_profiles WHERE user_id = ?
    `).get(req.user.userId);
    const recommendations = await getTutorRecommendations({ studentId: req.user.userId, student: student || {} });
    res.json({ recommendations, profileReady: normalized(student?.subjects_needed).length > 0 });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Unable to calculate tutor recommendations' });
  }
});

module.exports = router;
