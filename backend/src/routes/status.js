const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();

// Update user's online status
router.post('/online', authenticateToken, (req, res) => {
  try {
    const updateLastSeen = db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?');
    updateLastSeen.run(req.user.userId);
    
    res.json({ message: 'Status updated to online' });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get online users
router.get('/online', authenticateToken, (req, res) => {
  try {
    // Get users who were active in the last 5 minutes
    const onlineUsers = db.prepare(`
      SELECT id, name, avatar_url, last_seen, role
      FROM users 
      WHERE last_seen > datetime('now', '-5 minutes')
      AND id != ?
      ORDER BY last_seen DESC
    `).all(req.user.userId);

    res.json({ onlineUsers });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Failed to get online users' });
  }
});

// Get user status
router.get('/user/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = db.prepare(`
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
