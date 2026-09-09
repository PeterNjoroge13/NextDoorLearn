const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { isPositiveInteger, isValidDate, sanitizeText } = require('../utils/validation');

const router = express.Router();
const validStatuses = new Set(['active', 'paused', 'completed']);

const getStudentAccess = (req, requestedStudentId) => {
  if (req.user.role === 'student') {
    if (requestedStudentId && Number(requestedStudentId) !== Number(req.user.userId)) return null;
    return Number(req.user.userId);
  }

  if (!isPositiveInteger(requestedStudentId)) return null;
  const connection = db.prepare(`
    SELECT student_id FROM connections
    WHERE student_id = ? AND tutor_id = ? AND status = 'accepted'
  `).get(requestedStudentId, req.user.userId);
  return connection ? Number(connection.student_id) : null;
};

const hydrateGoals = (studentId) => {
  const goals = db.prepare(`
    SELECT * FROM learning_goals
    WHERE student_id = ?
    ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
             target_date IS NULL, target_date ASC, updated_at DESC
  `).all(studentId);

  const milestonesForGoal = db.prepare(`
    SELECT id, goal_id, title, is_completed, completed_at, created_at
    FROM goal_milestones WHERE goal_id = ? ORDER BY created_at ASC, id ASC
  `);

  return goals.map((goal) => ({
    ...goal,
    milestones: milestonesForGoal.all(goal.id).map((milestone) => ({
      ...milestone,
      is_completed: Boolean(milestone.is_completed)
    }))
  }));
};

const refreshGoalProgress = (goalId) => {
  const counts = db.prepare(`
    SELECT COUNT(*) AS total, SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS completed
    FROM goal_milestones WHERE goal_id = ?
  `).get(goalId);

  if (!counts.total) {
    db.prepare(`
      UPDATE learning_goals
      SET progress_percent = 0,
          status = CASE WHEN status = 'completed' THEN 'active' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(goalId);
    return;
  }
  const progress = Math.round((Number(counts.completed || 0) / counts.total) * 100);
  db.prepare(`
    UPDATE learning_goals
    SET progress_percent = ?,
        status = CASE WHEN ? = 100 THEN 'completed' WHEN status = 'completed' THEN 'active' ELSE status END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(progress, progress, goalId);
};

router.get('/goals', authenticateToken, (req, res) => {
  try {
    const studentId = getStudentAccess(req, req.query.studentId);
    if (!studentId) {
      return res.status(req.user.role === 'tutor' && !req.query.studentId ? 400 : 403).json({
        error: req.user.role === 'tutor' && !req.query.studentId
          ? 'Student ID is required'
          : 'You do not have access to this student\'s goals'
      });
    }

    const student = db.prepare('SELECT id, name, avatar_url FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ student, goals: hydrateGoals(studentId) });
  } catch (error) {
    console.error('Get learning goals error:', error);
    res.status(500).json({ error: 'Learning goals could not be loaded' });
  }
});

router.post('/goals', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can create learning goals' });
    const subject = sanitizeText(req.body.subject, 80);
    const title = sanitizeText(req.body.title, 160);
    const description = sanitizeText(req.body.description, 1200);
    const targetDate = sanitizeText(req.body.targetDate, 10) || null;

    if (!subject || !title) return res.status(400).json({ error: 'Subject and goal title are required' });
    if (targetDate && !isValidDate(targetDate)) return res.status(400).json({ error: 'Target date must be valid' });

    const result = db.prepare(`
      INSERT INTO learning_goals (student_id, subject, title, description, target_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.userId, subject, title, description, targetDate);
    res.status(201).json(hydrateGoals(req.user.userId).find((goal) => goal.id === Number(result.lastInsertRowid)));
  } catch (error) {
    console.error('Create learning goal error:', error);
    res.status(500).json({ error: 'Learning goal could not be created' });
  }
});

router.patch('/goals/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can update learning goals' });
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid goal ID is required' });
    const goal = db.prepare('SELECT * FROM learning_goals WHERE id = ? AND student_id = ?').get(req.params.id, req.user.userId);
    if (!goal) return res.status(404).json({ error: 'Learning goal not found' });

    const subject = req.body.subject === undefined ? goal.subject : sanitizeText(req.body.subject, 80);
    const title = req.body.title === undefined ? goal.title : sanitizeText(req.body.title, 160);
    const description = req.body.description === undefined ? goal.description : sanitizeText(req.body.description, 1200);
    const targetDate = req.body.targetDate === undefined ? goal.target_date : sanitizeText(req.body.targetDate, 10) || null;
    const status = req.body.status === undefined ? goal.status : sanitizeText(req.body.status, 20);
    const numericProgress = req.body.progressPercent === undefined ? goal.progress_percent : Number(req.body.progressPercent);

    if (!subject || !title) return res.status(400).json({ error: 'Subject and goal title are required' });
    if (targetDate && !isValidDate(targetDate)) return res.status(400).json({ error: 'Target date must be valid' });
    if (!validStatuses.has(status)) return res.status(400).json({ error: 'Invalid goal status' });
    if (!Number.isInteger(numericProgress) || numericProgress < 0 || numericProgress > 100) {
      return res.status(400).json({ error: 'Progress must be a whole number from 0 to 100' });
    }

    const nextStatus = numericProgress === 100 ? 'completed' : (status === 'completed' && numericProgress < 100 ? 'active' : status);
    db.prepare(`
      UPDATE learning_goals SET subject = ?, title = ?, description = ?, target_date = ?, status = ?, progress_percent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(subject, title, description, targetDate, nextStatus, numericProgress, goal.id);
    res.json(hydrateGoals(req.user.userId).find((item) => item.id === goal.id));
  } catch (error) {
    console.error('Update learning goal error:', error);
    res.status(500).json({ error: 'Learning goal could not be updated' });
  }
});

router.delete('/goals/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can delete learning goals' });
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid goal ID is required' });
    const result = db.prepare('DELETE FROM learning_goals WHERE id = ? AND student_id = ?').run(req.params.id, req.user.userId);
    if (!result.changes) return res.status(404).json({ error: 'Learning goal not found' });
    res.json({ message: 'Learning goal deleted' });
  } catch (error) {
    console.error('Delete learning goal error:', error);
    res.status(500).json({ error: 'Learning goal could not be deleted' });
  }
});

router.post('/goals/:id/milestones', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can add milestones' });
    const title = sanitizeText(req.body.title, 160);
    if (!isPositiveInteger(req.params.id) || !title) return res.status(400).json({ error: 'Valid goal ID and milestone title are required' });
    const goal = db.prepare('SELECT id FROM learning_goals WHERE id = ? AND student_id = ?').get(req.params.id, req.user.userId);
    if (!goal) return res.status(404).json({ error: 'Learning goal not found' });
    const result = db.prepare('INSERT INTO goal_milestones (goal_id, title) VALUES (?, ?)').run(goal.id, title);
    refreshGoalProgress(goal.id);
    res.status(201).json(db.prepare('SELECT * FROM goal_milestones WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Milestone could not be created' });
  }
});

router.patch('/milestones/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can update milestones' });
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid milestone ID is required' });
    const milestone = db.prepare(`
      SELECT gm.* FROM goal_milestones gm JOIN learning_goals lg ON lg.id = gm.goal_id
      WHERE gm.id = ? AND lg.student_id = ?
    `).get(req.params.id, req.user.userId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const title = req.body.title === undefined ? milestone.title : sanitizeText(req.body.title, 160);
    const completed = req.body.isCompleted === undefined ? Boolean(milestone.is_completed) : Boolean(req.body.isCompleted);
    if (!title) return res.status(400).json({ error: 'Milestone title is required' });
    db.prepare(`
      UPDATE goal_milestones SET title = ?, is_completed = ?, completed_at = ? WHERE id = ?
    `).run(title, completed ? 1 : 0, completed ? new Date().toISOString() : null, milestone.id);
    refreshGoalProgress(milestone.goal_id);
    res.json(hydrateGoals(req.user.userId).find((goal) => goal.id === milestone.goal_id));
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Milestone could not be updated' });
  }
});

router.delete('/milestones/:id', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can delete milestones' });
    if (!isPositiveInteger(req.params.id)) return res.status(400).json({ error: 'Valid milestone ID is required' });
    const milestone = db.prepare(`
      SELECT gm.id, gm.goal_id FROM goal_milestones gm JOIN learning_goals lg ON lg.id = gm.goal_id
      WHERE gm.id = ? AND lg.student_id = ?
    `).get(req.params.id, req.user.userId);
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
    db.prepare('DELETE FROM goal_milestones WHERE id = ?').run(milestone.id);
    refreshGoalProgress(milestone.goal_id);
    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Milestone could not be deleted' });
  }
});

module.exports = router;
