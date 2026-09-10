const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { getAvailabilitySlots } = require('../utils/availability');

const router = express.Router();

const parseList = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  }
};
const normalized = (values) => parseList(values).map((value) => String(value).trim().toLowerCase());
const includesText = (source, value) => String(source || '').toLowerCase().includes(String(value || '').toLowerCase());

const scoreTutor = (tutor, student, slots) => {
  let points = 0;
  const reasons = [];
  const needs = normalized(student.subjects_needed);
  const subjects = normalized(tutor.subjects);
  const subjectMatches = needs.filter((subject) => subjects.includes(subject));
  if (subjectMatches.length) {
    points += Math.min(45, 30 + (subjectMatches.length - 1) * 8);
    reasons.push(`Teaches ${subjectMatches.slice(0, 2).map((item) => item.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' and ')}`);
  }

  if (student.tutoring_mode && includesText(tutor.tutoring_mode, student.tutoring_mode)) {
    points += 15;
    reasons.push(`Offers ${student.tutoring_mode} tutoring`);
  }
  const ageGroups = normalized(tutor.age_groups);
  if (student.grade_level && ageGroups.some((group) => includesText(student.grade_level, group) || includesText(group, student.grade_level))) {
    points += 12;
    reasons.push(`Supports ${student.grade_level} learners`);
  }
  const wantsAffordable = /free|volunteer|low|under 20|affordable/i.test(student.budget_preference || '');
  if (Number(tutor.hourly_rate || 0) === 0) {
    points += wantsAffordable ? 16 : 10;
    reasons.push('Volunteer tutor');
  } else if (!wantsAffordable) {
    points += 7;
  }
  if (slots.length) {
    points += 8;
    reasons.push('Availability posted');
  }
  const reviewCount = Number(tutor.total_reviews || 0);
  const average = Number(tutor.average_rating || 0);
  const confidenceRating = ((reviewCount * average) + (5 * 3.5)) / (reviewCount + 5);
  points += Math.round((confidenceRating / 5) * 4);

  return { matchScore: Math.min(100, points), matchReasons: reasons.slice(0, 3) };
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student access required' });
    const student = await db.prepare(`
      SELECT grade_level, subjects_needed, preferred_schedule, learning_style, budget_preference, tutoring_mode
      FROM student_profiles WHERE user_id = ?
    `).get(req.user.userId);
    const tutors = await db.prepare(`
      SELECT u.id, u.name, u.bio, u.avatar_url, u.location, u.languages,
        tp.subjects, tp.hourly_rate, tp.experience_years, tp.education, tp.teaching_style,
        tp.headline, tp.tutoring_mode, tp.service_area, tp.age_groups, tp.public_profile_enabled,
        COALESCE(AVG(r.rating), 0) AS average_rating, COUNT(DISTINCT r.id) AS total_reviews,
        COUNT(DISTINCT c.student_id) AS active_students, tp.max_students
      FROM users u
      JOIN tutor_profiles tp ON tp.user_id = u.id
      LEFT JOIN reviews r ON r.tutor_id = u.id
      LEFT JOIN connections c ON c.tutor_id = u.id AND c.status = 'accepted'
      WHERE u.role = 'tutor' AND u.status = 'active' AND u.verified_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM connections mine WHERE mine.student_id = ? AND mine.tutor_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = ? AND b.blocked_user_id = u.id) OR
          (b.blocker_id = u.id AND b.blocked_user_id = ?))
      GROUP BY u.id, tp.id
      HAVING COUNT(DISTINCT c.student_id) < COALESCE(tp.max_students, 5)
    `).all(req.user.userId, req.user.userId, req.user.userId);

    const recommendations = [];
    for (const tutor of tutors) {
      const slots = await getAvailabilitySlots(tutor.id);
      const score = scoreTutor(tutor, student || {}, slots);
      recommendations.push({
        ...tutor,
        subjects: parseList(tutor.subjects),
        languages: parseList(tutor.languages),
        age_groups: parseList(tutor.age_groups),
        availability: slots,
        averageRating: Math.round(Number(tutor.average_rating || 0) * 10) / 10,
        totalReviews: Number(tutor.total_reviews || 0),
        ...score
      });
    }
    recommendations.sort((a, b) => b.matchScore - a.matchScore || b.totalReviews - a.totalReviews);
    res.json({ recommendations: recommendations.slice(0, 12), profileReady: normalized(student?.subjects_needed).length > 0 });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Unable to calculate tutor recommendations' });
  }
});

module.exports = router;
