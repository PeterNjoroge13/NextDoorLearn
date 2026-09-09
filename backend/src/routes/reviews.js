const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// Create a review (students only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.userId;
    
    // Only students can create reviews
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can create reviews' });
    }

    const { tutorId, rating, comment, sessionId } = req.body;

    // Validate required fields
    if (!tutorId || !rating) {
      return res.status(400).json({ error: 'Tutor ID and rating are required' });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if tutor exists
    const tutor = await db.prepare('SELECT id, role FROM users WHERE id = ? AND role = ?').get(tutorId, 'tutor');
    if (!tutor) {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    // Check if student has a connection with this tutor
    const connection = await db.prepare(`
      SELECT id FROM connections 
      WHERE student_id = ? AND tutor_id = ? AND status = 'accepted'
    `).get(studentId, tutorId);

    if (!connection) {
      return res.status(403).json({ error: 'You must be connected with this tutor to leave a review' });
    }

    // Check if review already exists
    const existingReview = await db.prepare(`
      SELECT id FROM reviews WHERE tutor_id = ? AND student_id = ?
    `).get(tutorId, studentId);

    if (existingReview) {
      // Update existing review
      const updateReview = await db.prepare(`
        UPDATE reviews 
        SET rating = ?, comment = ?, session_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE tutor_id = ? AND student_id = ?
      `);
      await updateReview.run(rating, comment || null, sessionId || null, tutorId, studentId);
      
      return res.json({ 
        message: 'Review updated successfully',
        review: {
          id: existingReview.id,
          tutorId,
          studentId,
          rating,
          comment,
          sessionId
        }
      });
    }

    // Create new review
    const insertReview = await db.prepare(`
      INSERT INTO reviews (tutor_id, student_id, rating, comment, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = await insertReview.run(tutorId, studentId, rating, comment || null, sessionId || null);

    // Notify tutor of new review
    const stars = '⭐'.repeat(rating);
    await createNotification(
      tutorId,
      'review',
      'New review received!',
      `${req.user.name} gave you ${rating} stars ${stars}${comment ? `: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"` : ''}`,
      '/profile',
      result.lastInsertRowid
    );

    res.status(201).json({
      message: 'Review created successfully',
      review: {
        id: result.lastInsertRowid,
        tutorId,
        studentId,
        rating,
        comment,
        sessionId
      }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reviews for a tutor
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;

    const reviews = await db.prepare(`
      SELECT 
        r.id,
        r.rating,
        r.comment,
        r.session_id,
        r.created_at,
        r.updated_at,
        u.id as student_id,
        u.name as student_name,
        u.avatar_url as student_avatar
      FROM reviews r
      JOIN users u ON r.student_id = u.id
      WHERE r.tutor_id = ?
      ORDER BY r.created_at DESC
    `).all(tutorId);

    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get average rating for a tutor
router.get('/tutor/:tutorId/average', async (req, res) => {
  try {
    const { tutorId } = req.params;

    const result = await db.prepare(`
      SELECT 
        COALESCE(AVG(rating), 0) as averageRating,
        COUNT(*) as totalReviews
      FROM reviews
      WHERE tutor_id = ?
    `).get(tutorId);

    res.json({
      averageRating: Math.round(result.averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: result.totalReviews
    });
  } catch (error) {
    console.error('Get average rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's review for a tutor (if they've reviewed)
router.get('/tutor/:tutorId/my-review', authenticateToken, async (req, res) => {
  try {
    const { tutorId } = req.params;
    const studentId = req.user.userId;

    const review = await db.prepare(`
      SELECT * FROM reviews
      WHERE tutor_id = ? AND student_id = ?
    `).get(tutorId, studentId);

    if (!review) {
      return res.json({ review: null });
    }

    res.json({ review });
  } catch (error) {
    console.error('Get my review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a review (student can delete their own review)
router.delete('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    // Check if review exists and belongs to user
    const review = await db.prepare('SELECT * FROM reviews WHERE id = ? AND student_id = ?').get(reviewId, userId);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found or you do not have permission to delete it' });
    }

    await db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
