const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isPositiveInteger } = require('../utils/validation');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can manage favorite tutors' });
    }

    const favorites = db.prepare(`
      SELECT 
        f.id as favorite_id,
        f.created_at as favorited_at,
        u.id,
        u.name,
        u.bio,
        u.avatar_url,
        u.location,
        u.languages,
        tp.subjects,
        tp.hourly_rate,
        tp.experience_years,
        tp.education,
        tp.teaching_style,
        COALESCE(AVG(r.rating), 0) as averageRating,
        COUNT(r.id) as totalReviews
      FROM favorites f
      JOIN users u ON f.tutor_id = u.id
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE f.student_id = ? AND u.role = 'tutor'
      GROUP BY f.id, u.id, tp.id
      ORDER BY f.created_at DESC
    `).all(req.user.userId);

    res.json(favorites.map((favorite) => ({
      ...favorite,
      subjects: safeJsonArray(favorite.subjects),
      languages: safeJsonArray(favorite.languages)
    })));
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:tutorId', authenticateToken, (req, res) => {
  try {
    const tutorId = req.params.tutorId;

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can favorite tutors' });
    }

    if (!isPositiveInteger(tutorId)) {
      return res.status(400).json({ error: 'Valid tutor ID is required' });
    }

    const tutor = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'tutor'").get(tutorId);
    if (!tutor) {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO favorites (student_id, tutor_id)
      VALUES (?, ?)
    `).run(req.user.userId, tutorId);

    res.status(201).json({ message: 'Tutor saved to favorites', tutorId: Number(tutorId) });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:tutorId', authenticateToken, (req, res) => {
  try {
    const tutorId = req.params.tutorId;

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can manage favorite tutors' });
    }

    if (!isPositiveInteger(tutorId)) {
      return res.status(400).json({ error: 'Valid tutor ID is required' });
    }

    db.prepare(`
      DELETE FROM favorites
      WHERE student_id = ? AND tutor_id = ?
    `).run(req.user.userId, tutorId);

    res.json({ message: 'Tutor removed from favorites', tutorId: Number(tutorId) });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const safeJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

module.exports = router;
