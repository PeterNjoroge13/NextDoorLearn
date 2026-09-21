const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { getAvailabilitySlots } = require('../utils/availability');
const {
  isPositiveInteger,
  isValidHttpUrl,
  isValidTimeZone,
  normalizeStringArray,
  passwordValidationError,
  sanitizeText
} = require('../utils/validation');

const router = express.Router();

const optionalNumber = (value, { min, max, integer = false }) => {
  if (value === undefined) return { value: null };
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max || (integer && !Number.isInteger(numeric))) {
    return { error: `Value must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}` };
  }
  return { value: numeric };
};

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await db.prepare(`
      SELECT id, email, role, name, bio, avatar_url, phone, location, timezone,
             languages, website, linkedin, age_group, created_at
      FROM users WHERE id = ?
    `).get(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get role-specific profile
    let profile = {};
    if (user.role === 'tutor') {
      profile = await db.prepare(`
        SELECT subjects, availability, hourly_rate, experience_years, 
               education, certifications, teaching_style, headline, motivation,
               tutoring_mode, service_area, max_students, availability_notes,
               age_groups, public_profile_enabled
        FROM tutor_profiles WHERE user_id = ?
      `).get(userId);
    } else {
      profile = await db.prepare(`
        SELECT grade_level, subjects_needed, school, learning_goals, preferred_schedule,
               learning_style, support_needs, budget_preference, tutoring_mode,
               accessibility_needs, guardian_name, guardian_contact, intake_completed_at
        FROM student_profiles WHERE user_id = ?
      `).get(userId);
    }

    // Parse JSON fields
    if (user.languages) {
      try { user.languages = JSON.parse(user.languages); } catch (e) { user.languages = []; }
    }

    const googleIntegration = await db.prepare(`
      SELECT provider, sync_enabled, calendar_id, updated_at
      FROM user_google_integrations
      WHERE user_id = ? AND provider = 'google'
    `).get(userId);
    const policyAcceptances = await db.prepare(`
      SELECT policy_type, policy_version, accepted_at
      FROM policy_acceptances WHERE user_id = ? ORDER BY accepted_at DESC
    `).all(userId);

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
      },
      policyAcceptances
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, phone, location, timezone, languages, website, linkedin, profile } = req.body;
    if (name !== undefined && !sanitizeText(name, 120)) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (languages !== undefined && !Array.isArray(languages)) {
      return res.status(400).json({ error: 'Languages must be a list' });
    }
    if (profile !== undefined && (!profile || typeof profile !== 'object' || Array.isArray(profile))) {
      return res.status(400).json({ error: 'Profile must be an object' });
    }
    const safeLanguages = languages === undefined
      ? null
      : normalizeStringArray(languages, { maxItems: 12, maxLength: 40 });
    const safeWebsite = website === undefined ? null : sanitizeText(website, 500);
    const safeLinkedin = linkedin === undefined ? null : sanitizeText(linkedin, 500);
    if ((safeWebsite && !isValidHttpUrl(safeWebsite)) || (safeLinkedin && !isValidHttpUrl(safeLinkedin))) {
      return res.status(400).json({ error: 'Website and LinkedIn links must start with http:// or https://' });
    }
    if (timezone !== undefined && String(timezone).trim() && !isValidTimeZone(String(timezone))) {
      return res.status(400).json({ error: 'Choose a valid timezone such as America/New_York' });
    }

    // Update basic user info
    const updateUser = await db.prepare(`
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
    
    await updateUser.run(
      name !== undefined ? sanitizeText(name, 120) || null : null,
      bio !== undefined ? sanitizeText(bio, 2000) : null,
      phone !== undefined ? sanitizeText(phone, 60) : null,
      location !== undefined ? sanitizeText(location, 160) : null,
      timezone !== undefined ? sanitizeText(timezone, 80) : null,
      safeLanguages ? JSON.stringify(safeLanguages) : null,
      safeWebsite,
      safeLinkedin,
      userId
    );

    // Update role-specific profile
    if (profile) {
      if (req.user.role === 'tutor') {
        const {
          subjects, availability, hourly_rate, experience_years, education, certifications,
          teaching_style, headline, motivation, tutoring_mode, service_area, max_students,
          availability_notes, age_groups, public_profile_enabled
        } = profile;
        if (subjects !== undefined && !Array.isArray(subjects)) {
          return res.status(400).json({ error: 'Subjects must be a list' });
        }
        if (certifications !== undefined && !Array.isArray(certifications)) {
          return res.status(400).json({ error: 'Certifications must be a list' });
        }
        if (age_groups !== undefined && !Array.isArray(age_groups)) {
          return res.status(400).json({ error: 'Age groups must be a list' });
        }
        if (availability !== undefined && (!availability || typeof availability !== 'object' || Array.isArray(availability))) {
          return res.status(400).json({ error: 'Availability must be an object' });
        }
        if (availability !== undefined && Buffer.byteLength(JSON.stringify(availability), 'utf8') > 10000) {
          return res.status(400).json({ error: 'Availability details are too large' });
        }
        const safeHourlyRate = optionalNumber(hourly_rate, { min: 0, max: 500 });
        const safeExperienceYears = optionalNumber(experience_years, { min: 0, max: 80, integer: true });
        const safeMaxStudents = optionalNumber(max_students, { min: 1, max: 100, integer: true });
        if (safeHourlyRate.error || safeExperienceYears.error || safeMaxStudents.error) {
          return res.status(400).json({ error: safeHourlyRate.error || safeExperienceYears.error || safeMaxStudents.error });
        }
        if (public_profile_enabled !== undefined && typeof public_profile_enabled !== 'boolean') {
          return res.status(400).json({ error: 'Public profile setting must be true or false' });
        }
        const updateTutorProfile = await db.prepare(`
          UPDATE tutor_profiles SET 
            subjects = COALESCE(?, subjects),
            availability = COALESCE(?, availability),
            hourly_rate = COALESCE(?, hourly_rate),
            experience_years = COALESCE(?, experience_years),
            education = COALESCE(?, education),
            certifications = COALESCE(?, certifications),
            teaching_style = COALESCE(?, teaching_style),
            headline = COALESCE(?, headline),
            motivation = COALESCE(?, motivation),
            tutoring_mode = COALESCE(?, tutoring_mode),
            service_area = COALESCE(?, service_area),
            max_students = COALESCE(?, max_students),
            availability_notes = COALESCE(?, availability_notes),
            age_groups = COALESCE(?, age_groups),
            public_profile_enabled = COALESCE(?, public_profile_enabled)
          WHERE user_id = ?
        `);
        await updateTutorProfile.run(
          subjects !== undefined ? JSON.stringify(normalizeStringArray(subjects, { maxItems: 20, maxLength: 80 })) : null,
          availability !== undefined ? JSON.stringify(availability) : null,
          safeHourlyRate.value,
          safeExperienceYears.value,
          education !== undefined ? sanitizeText(education, 1000) : null,
          certifications !== undefined ? JSON.stringify(normalizeStringArray(certifications, { maxItems: 20, maxLength: 160 })) : null,
          teaching_style !== undefined ? sanitizeText(teaching_style, 1000) : null,
          headline !== undefined ? sanitizeText(headline, 160) : null,
          motivation !== undefined ? sanitizeText(motivation, 2000) : null,
          tutoring_mode !== undefined ? sanitizeText(tutoring_mode, 40) : null,
          service_area !== undefined ? sanitizeText(service_area, 160) : null,
          safeMaxStudents.value,
          availability_notes !== undefined ? sanitizeText(availability_notes, 1000) : null,
          age_groups !== undefined ? JSON.stringify(normalizeStringArray(age_groups, { maxItems: 10, maxLength: 60 })) : null,
          public_profile_enabled !== undefined ? (public_profile_enabled ? 1 : 0) : null,
          userId
        );
      } else {
        const {
          grade_level, subjects_needed, school, learning_goals, preferred_schedule,
          learning_style, support_needs, budget_preference, tutoring_mode,
          accessibility_needs, guardian_name, guardian_contact, intake_completed
        } = profile;
        if (subjects_needed !== undefined && !Array.isArray(subjects_needed)) {
          return res.status(400).json({ error: 'Subjects needed must be a list' });
        }
        if (intake_completed !== undefined && typeof intake_completed !== 'boolean') {
          return res.status(400).json({ error: 'Intake completion must be true or false' });
        }
        const updateStudentProfile = await db.prepare(`
          UPDATE student_profiles SET 
            grade_level = COALESCE(?, grade_level),
            subjects_needed = COALESCE(?, subjects_needed),
            school = COALESCE(?, school),
            learning_goals = COALESCE(?, learning_goals),
            preferred_schedule = COALESCE(?, preferred_schedule),
            learning_style = COALESCE(?, learning_style),
            support_needs = COALESCE(?, support_needs),
            budget_preference = COALESCE(?, budget_preference),
            tutoring_mode = COALESCE(?, tutoring_mode),
            accessibility_needs = COALESCE(?, accessibility_needs),
            guardian_name = COALESCE(?, guardian_name),
            guardian_contact = COALESCE(?, guardian_contact),
            intake_completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE intake_completed_at END
          WHERE user_id = ?
        `);
        await updateStudentProfile.run(
          grade_level !== undefined ? sanitizeText(grade_level, 80) : null,
          subjects_needed !== undefined ? JSON.stringify(normalizeStringArray(subjects_needed, { maxItems: 20, maxLength: 80 })) : null,
          school !== undefined ? sanitizeText(school, 160) : null,
          learning_goals !== undefined ? sanitizeText(learning_goals, 2000) : null,
          preferred_schedule !== undefined ? sanitizeText(preferred_schedule, 1000) : null,
          learning_style !== undefined ? sanitizeText(learning_style, 500) : null,
          support_needs !== undefined ? sanitizeText(support_needs, 1000) : null,
          budget_preference !== undefined ? sanitizeText(budget_preference, 40) : null,
          tutoring_mode !== undefined ? sanitizeText(tutoring_mode, 40) : null,
          accessibility_needs !== undefined ? sanitizeText(accessibility_needs, 1000) : null,
          guardian_name !== undefined ? sanitizeText(guardian_name, 120) : null,
          guardian_contact !== undefined ? sanitizeText(guardian_contact, 160) : null,
          intake_completed ? 1 : 0,
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

    const passwordError = passwordValidationError(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    // Get current user
    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
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

    await db.withTransaction(async (transaction) => {
      await transaction.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(newPasswordHash, userId);
      await transaction.prepare('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').run(userId);
    });

    res.json({ message: 'Password changed successfully. Sign in again on your devices.', reauthenticate: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Permanently delete the signed-in account. Store policies require this to be available in-app.
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const currentPassword = String(req.body.currentPassword || '');
    const confirmation = String(req.body.confirmation || '').trim().toUpperCase();

    if (!currentPassword || confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Enter your password and type DELETE to confirm' });
    }

    const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await db.withTransaction(async (transaction) => {
      // These audit relationships intentionally restrict deletion; remove the actor-owned rows first.
      await transaction.prepare('DELETE FROM moderation_actions WHERE admin_user_id = ?').run(userId);
      await transaction.prepare('DELETE FROM admin_audit_logs WHERE admin_user_id = ?').run(userId);
      await transaction.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    res.json({ message: 'Your account and personal data have been deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Unable to delete account' });
  }
});

// Get all tutors
router.get('/tutors', authenticateToken, async (req, res) => {
  try {
    const tutors = await db.prepare(`
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
        tp.headline,
        tp.tutoring_mode,
        tp.service_area,
        tp.age_groups,
        tp.public_profile_enabled,
        COALESCE(AVG(r.rating), 0) as averageRating,
        COUNT(r.id) as totalReviews
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE u.role = 'tutor' AND u.status = 'active' AND u.verified_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = ? AND b.blocked_user_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_user_id = ?)
        )
      GROUP BY u.id, u.name, u.bio, u.avatar_url, u.location, u.languages,
               tp.subjects, tp.availability, tp.hourly_rate, tp.experience_years, 
               tp.education, tp.teaching_style, tp.headline, tp.tutoring_mode,
               tp.service_area, tp.age_groups, tp.public_profile_enabled
    `).all(req.user.userId, req.user.userId);

    // Parse JSON fields and format ratings
    const formattedTutors = await Promise.all(tutors.map(async (tutor) => {
      let subjects = [];
      let availability = {};
      let languages = [];
      
      try { subjects = JSON.parse(tutor.subjects); } catch (e) {}
      try { availability = JSON.parse(tutor.availability); } catch (e) {}
      try { languages = tutor.languages ? JSON.parse(tutor.languages) : []; } catch (e) {}
      
      const slotAvailability = await getAvailabilitySlots(tutor.id);

      return {
        ...tutor,
        subjects,
        availability: slotAvailability.length > 0 ? slotAvailability : availability,
        languages,
        age_groups: safeJsonArray(tutor.age_groups),
        public_profile_enabled: Boolean(tutor.public_profile_enabled),
        averageRating: Math.round(tutor.averageRating * 10) / 10,
        totalReviews: tutor.totalReviews
      };
    }));

    res.json(formattedTutors);
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get one tutor profile
router.get('/tutors/:tutorId', authenticateToken, async (req, res) => {
  try {
    const { tutorId } = req.params;

    if (!isPositiveInteger(tutorId)) {
      return res.status(400).json({ error: 'Valid tutor ID is required' });
    }

    const tutor = await db.prepare(`
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
        tp.headline,
        tp.motivation,
        tp.tutoring_mode,
        tp.service_area,
        tp.max_students,
        tp.availability_notes,
        tp.age_groups,
        tp.public_profile_enabled,
        COALESCE(AVG(r.rating), 0) as averageRating,
        COUNT(r.id) as totalReviews
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE u.id = ? AND u.role = 'tutor' AND u.status = 'active' AND u.verified_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = ? AND b.blocked_user_id = u.id)
             OR (b.blocker_id = u.id AND b.blocked_user_id = ?)
        )
      GROUP BY u.id, tp.id
    `).get(tutorId, req.user.userId, req.user.userId);

    if (!tutor) {
      return res.status(404).json({ error: 'Tutor not found' });
    }

    const reviews = await db.prepare(`
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        'NextDoorLearn student' as student_name,
        NULL as student_avatar
      FROM reviews r
      WHERE r.tutor_id = ?
      ORDER BY r.created_at DESC
      LIMIT 8
    `).all(tutorId);

    res.json({
      ...tutor,
      subjects: safeJsonArray(tutor.subjects),
      languages: safeJsonArray(tutor.languages),
      certifications: safeJsonArray(tutor.certifications),
      age_groups: safeJsonArray(tutor.age_groups),
      public_profile_enabled: Boolean(tutor.public_profile_enabled),
      availability: await getAvailabilitySlots(tutor.id),
      averageRating: Math.round(tutor.averageRating * 10) / 10,
      totalReviews: tutor.totalReviews,
      reviews
    });
  } catch (error) {
    console.error('Get tutor profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public tutor pages are opt-in and intentionally exclude private contact details.
router.get('/public/tutors/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    if (!isPositiveInteger(tutorId)) return res.status(400).json({ error: 'Valid tutor ID is required' });

    const tutor = await db.prepare(`
      SELECT u.id, u.name, u.bio, u.avatar_url, u.languages,
             tp.subjects, tp.hourly_rate, tp.experience_years, tp.education,
             tp.certifications, tp.teaching_style, tp.headline, tp.motivation,
             tp.tutoring_mode, tp.service_area, tp.age_groups,
             COALESCE(AVG(r.rating), 0) AS averageRating, COUNT(r.id) AS totalReviews
      FROM users u
      JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN reviews r ON u.id = r.tutor_id
      WHERE u.id = ? AND u.role = 'tutor' AND u.status = 'active' AND u.verified_at IS NOT NULL
        AND tp.public_profile_enabled = 1
      GROUP BY u.id, tp.id
    `).get(tutorId);

    if (!tutor) return res.status(404).json({ error: 'Public tutor profile not found' });

    const reviews = (await db.prepare(`
      SELECT id, rating, comment, created_at
      FROM reviews WHERE tutor_id = ? AND comment IS NOT NULL AND trim(comment) != ''
      ORDER BY created_at DESC LIMIT 6
    `).all(tutorId)).map((review) => ({ ...review, student_name: 'NextDoorLearn student' }));

    res.json({
      ...tutor,
      subjects: safeJsonArray(tutor.subjects),
      languages: safeJsonArray(tutor.languages),
      certifications: safeJsonArray(tutor.certifications),
      age_groups: safeJsonArray(tutor.age_groups),
      averageRating: Math.round(tutor.averageRating * 10) / 10,
      reviews
    });
  } catch (error) {
    console.error('Get public tutor profile error:', error);
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
router.get('/profile-completion', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    const user = await db.prepare(`
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
      profile = await db.prepare(`
        SELECT subjects, hourly_rate, experience_years, education, teaching_style,
               headline, motivation, tutoring_mode, age_groups
        FROM tutor_profiles WHERE user_id = ?
      `).get(userId);

      const tutorFields = ['subjects', 'experience_years', 'education', 'teaching_style', 'headline', 'motivation', 'tutoring_mode', 'age_groups'];
      tutorFields.forEach(field => {
        totalFields++;
        if (profile && profile[field]) {
          if (field === 'subjects') {
            try {
              const subjects = JSON.parse(profile[field]);
              if (subjects.length > 0) completedFields++;
            } catch (e) {}
          } else if (field === 'age_groups') {
            if (safeJsonArray(profile[field]).length > 0) completedFields++;
          } else {
            completedFields++;
          }
        }
      });
    } else {
      profile = await db.prepare(`
        SELECT grade_level, subjects_needed, school, learning_goals, preferred_schedule,
               learning_style, support_needs, budget_preference, tutoring_mode
        FROM student_profiles WHERE user_id = ?
      `).get(userId);

      const studentFields = ['grade_level', 'subjects_needed', 'school', 'learning_goals', 'preferred_schedule', 'learning_style', 'support_needs', 'budget_preference', 'tutoring_mode'];
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
