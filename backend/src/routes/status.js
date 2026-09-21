const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');
const { isPositiveInteger } = require('../utils/validation');

const router = express.Router();

// Update user's online status
router.post('/online', authenticateToken, async (req, res) => {
  try {
    const updateLastSeen = await db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?');
    await updateLastSeen.run(req.user.userId);
    
    res.json({ message: 'Status updated to online' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get online users
router.get('/online', authenticateToken, async (req, res) => {
  try {
    // Presence is private to accepted, unblocked connections.
    const onlineUsers = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.avatar_url, u.last_seen, u.role
      FROM users u
      JOIN connections c ON (c.student_id = ? AND c.tutor_id = u.id)
        OR (c.tutor_id = ? AND c.student_id = u.id)
      WHERE u.last_seen > datetime('now', '-5 minutes') AND c.status = 'accepted'
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
        (b.blocker_id = c.student_id AND b.blocked_user_id = c.tutor_id) OR
        (b.blocker_id = c.tutor_id AND b.blocked_user_id = c.student_id))
      ORDER BY last_seen DESC
    `).all(req.user.userId, req.user.userId);

    res.json({ onlineUsers });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Failed to get online users' });
  }
});

// Get user status
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isPositiveInteger(userId)) return res.status(400).json({ error: 'Valid user ID is required' });

    const allowed = Number(userId) === Number(req.user.userId) || await db.prepare(`
      SELECT id FROM connections
      WHERE status = 'accepted'
        AND ((student_id = ? AND tutor_id = ?) OR (student_id = ? AND tutor_id = ?))
        AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
          (b.blocker_id = connections.student_id AND b.blocked_user_id = connections.tutor_id) OR
          (b.blocker_id = connections.tutor_id AND b.blocked_user_id = connections.student_id))
    `).get(req.user.userId, userId, userId, req.user.userId);
    if (!allowed) return res.status(404).json({ error: 'User status not found' });

    const user = await db.prepare(`
      SELECT id, name, avatar_url, last_seen, role
      FROM users 
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is online (active in last 5 minutes)
    const isOnline = new Date(user.last_seen) > new Date(Date.now() - 5 * 60 * 1000);
    
    res.json({ 
      ...user, 
      isOnline,
      lastSeenFormatted: formatLastSeen(user.last_seen)
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ error: 'Failed to get user status' });
  }
});

// Helper function to format last seen time
function formatLastSeen(lastSeen) {
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Online now';
  if (diffInMinutes < 5) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} days ago`;
  
  return lastSeenDate.toLocaleDateString();
}

module.exports = router;
