const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { getAvailabilitySlots } = require('../utils/availability');
const { isPositiveInteger } = require('../utils/validation');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = db.prepare(`
      SELECT id, email, role, name, bio, avatar_url, phone, location, timezone, 
             languages, website, linkedin, created_at 
      FROM users WHERE id = ?
    `).get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get role-specific profile
    let profile = {};
    if (user.role === 'tutor') {
      profile = db.prepare(`
        SELECT subjects, availability, hourly_rate, experience_years, 
               education, certifications, teaching_style 
        FROM tutor_profiles WHERE user_id = ?
      `).get(userId);
    } else {
      profile = db.prepare(`
        SELECT grade_level, subjects_needed, school, learning_goals, preferred_schedule 
        FROM student_profiles WHERE user_id = ?
      `).get(userId);
    }

    // Parse JSON fields
    if (user.languages) {
      try { user.languages = JSON.parse(user.languages); } catch (e) { user.languages = []; }
    }

    const googleIntegration = db.prepare(`
      SELECT provider, sync_enabled, calendar_id, updated_at
      FROM user_google_integrations
      WHERE user_id = ? AND provider = 'google'
    `).get(userId);

    res.json({
      ...user,
      profile,
      integrations: {
        google: googleIntegration
          ? {
              provider: googleIntegration.provider,
              syncEnabled: Boolean(googleIntegration.sync_enabled),
              calendarId: googleIntegration.calendar_id,
              updatedAt: googleIntegration.updated_at
            }
          : null
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, phone, location, timezone, languages, website, linkedin, profile } = req.body;

    // Update basic user info
    const updateUser = db.prepare(`
      UPDATE users SET 
        name = COALESCE(?, name),
        bio = COALESCE(?, bio),
        phone = COALESCE(?, phone),
        location = COALESCE(?, location),
        timezone = COALESCE(?, timezone),
        languages = COALESCE(?, languages),
        website = COALESCE(?, website),
        linkedin = COALESCE(?, linkedin)
      WHERE id = ?
    `);
    
    updateUser.run(
      name || null,
      bio !== undefined ? bio : null,
      phone !== undefined ? phone : null,
      location !== undefined ? location : null,
      timezone !== undefined ? timezone : null,
      languages ? JSON.stringify(languages) : null,
      website !== undefined ? website : null,
      linkedin !== undefined ? linkedin : null,
      userId
    );

    // Update role-specific profile
    if (profile) {
      if (req.user.role === 'tutor') {
        const { subjects, availability, hourly_rate, experience_years, education, certifications, teaching_style } = profile;
        const updateTutorProfile = db.prepare(`
          UPDATE tutor_profiles SET 
            subjects = COALESCE(?, subjects),
            availability = COALESCE(?, availability),
            hourly_rate = COALESCE(?, hourly_rate),
            experience_years = COALESCE(?, experience_years),
            education = COALESCE(?, education),
            certifications = COALESCE(?, certifications),
            teaching_style = COALESCE(?, teaching_style)
          WHERE user_id = ?
        `);
        updateTutorProfile.run(
          subjects ? JSON.stringify(subjects) : null,
          availability ? JSON.stringify(availability) : null,
          hourly_rate !== undefined ? hourly_rate : null,
          experience_years !== undefined ? experience_years : null,
          education !== undefined ? education : null,
          certifications !== undefined ? certifications : null,
          teaching_style !== undefined ? teaching_style : null,
          userId
        );
      } else {
        const { grade_level, subjects_needed, school, learning_goals, preferred_schedule } = profile;
        const updateStudentProfile = db.prepare(`
          UPDATE student_profiles SET 
            grade_level = COALESCE(?, grade_level),
            subjects_needed = COALESCE(?, subjects_needed),
            school = COALESCE(?, school),
            learning_goals = COALESCE(?, learning_goals),
            preferred_schedule = COALESCE(?, preferred_schedule)
          WHERE user_id = ?
        `);
        updateStudentProfile.run(
          grade_level !== undefined ? grade_level : null,
          subjects_needed ? JSON.stringify(subjects_needed) : null,
          school !== undefined ? school : null,
          learning_goals !== undefined ? learning_goals : null,
          preferred_schedule !== undefined ? preferred_schedule : null,
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

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    updatePassword.run(newPasswordHash, userId);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tutors
router.get('/tutors', (req, res) => {
  try {
    const tutors = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.bio, 
        u.avatar_url,
        u.location,
        u.languages,
        tp.subjects, 
        tp.availability, 
        tp.hourly_rate,
        tp.experience_years,
        tp.education,
        tp.teaching_style,
        COALESCE(AVG(r.rating), 0) as averageRating,
        COUNT(r.id) as totalReviews
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE u.role = 'tutor'
      GROUP BY u.id, u.name, u.bio, u.avatar_url, u.location, u.languages,
               tp.subjects, tp.availability, tp.hourly_rate, tp.experience_years, 
               tp.education, tp.teaching_style
    `).all();

    // Parse JSON fields and format ratings
    const formattedTutors = tutors.map(tutor => {
      let subjects = [];
      let availability = {};
      let languages = [];
      
      try { subjects = JSON.parse(tutor.subjects); } catch (e) {}
      try { availability = JSON.parse(tutor.availability); } catch (e) {}
      try { languages = tutor.languages ? JSON.parse(tutor.languages) : []; } catch (e) {}
      
      const slotAvailability = getAvailabilitySlots(tutor.id);

      return {
        ...tutor,
        subjects,
        availability: slotAvailability.length > 0 ? slotAvailability : availability,
        languages,
        averageRating: Math.round(tutor.averageRating * 10) / 10,
        totalReviews: tutor.totalReviews
      };
    });

    res.json(formattedTutors);
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get one tutor profile
router.get('/tutors/:tutorId', authenticateToken, (req, res) => {
  try {
    const { tutorId } = req.params;

    if (!isPositiveInteger(tutorId)) {
      return res.status(400).json({ error: 'Valid tutor ID is required' });
    }

    const tutor = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.bio,
        u.avatar_url,
        u.location,
        u.languages,
        u.website,
        u.linkedin,
        u.created_at,
        tp.subjects,
        tp.hourly_rate,
        tp.experience_years,
        tp.education,
        tp.certifications,
        tp.teaching_style,
        COALESCE(AVG(r.rating), 0) as averageRating,
        COUNT(r.id) as totalReviews
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE u.id = ? AND u.role = 'tutor'
      GROUP BY u.id, tp.id
    `).get(tutorId);

    if (!tutor) {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    const reviews = db.prepare(`
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name as student_name,
        u.avatar_url as student_avatar
      FROM reviews r
      JOIN users u ON r.student_id = u.id
      WHERE r.tutor_id = ?
      ORDER BY r.created_at DESC
      LIMIT 8
    `).all(tutorId);

    res.json({
      ...tutor,
      subjects: safeJsonArray(tutor.subjects),
      languages: safeJsonArray(tutor.languages),
      certifications: safeJsonArray(tutor.certifications),
      availability: getAvailabilitySlots(tutor.id),
      averageRating: Math.round(tutor.averageRating * 10) / 10,
      totalReviews: tutor.totalReviews,
      reviews
    });
  } catch (error) {
    console.error('Get tutor profile error:', error);
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

// Get profile completion percentage
router.get('/profile-completion', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    const user = db.prepare(`
      SELECT name, bio, avatar_url, phone, location, timezone, languages 
      FROM users WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let profile = {};
    let totalFields = 0;
    let completedFields = 0;

    // Common fields for all users
    const commonFields = ['name', 'bio', 'avatar_url', 'phone', 'location', 'timezone'];
    commonFields.forEach(field => {
      totalFields++;
      if (user[field]) completedFields++;
    });

    if (role === 'tutor') {
      profile = db.prepare(`
        SELECT subjects, hourly_rate, experience_years, education, teaching_style 
        FROM tutor_profiles WHERE user_id = ?
      `).get(userId);

      const tutorFields = ['subjects', 'hourly_rate', 'experience_years', 'education', 'teaching_style'];
      tutorFields.forEach(field => {
        totalFields++;
        if (profile && profile[field]) {
          if (field === 'subjects') {
            try {
              const subjects = JSON.parse(profile[field]);
              if (subjects.length > 0) completedFields++;
            } catch (e) {}
          } else if (field === 'hourly_rate') {
            if (profile[field] > 0) completedFields++;
          } else {
            completedFields++;
          }
        }
      });
    } else {
      profile = db.prepare(`
        SELECT grade_level, subjects_needed, school, learning_goals 
        FROM student_profiles WHERE user_id = ?
      `).get(userId);

      const studentFields = ['grade_level', 'subjects_needed', 'school', 'learning_goals'];
      studentFields.forEach(field => {
        totalFields++;
        if (profile && profile[field]) {
          if (field === 'subjects_needed') {
            try {
              const subjects = JSON.parse(profile[field]);
              if (subjects.length > 0) completedFields++;
            } catch (e) {}
          } else {
            completedFields++;
          }
        }
      });
    }

    const percentage = Math.round((completedFields / totalFields) * 100);

    res.json({
      percentage,
      completedFields,
      totalFields,
      missingFields: totalFields - completedFields
    });
  } catch (error) {
    console.error('Profile completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
