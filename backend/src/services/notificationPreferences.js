const db = require('../db/database');

const DEFAULT_PREFERENCES = Object.freeze({
  emailEnabled: true,
  pushEnabled: true,
  messagesEnabled: true,
  connectionsEnabled: true,
  sessionsEnabled: true,
  remindersEnabled: true,
  reviewsEnabled: true
});

const preferenceColumns = Object.freeze({
  emailEnabled: 'email_enabled',
  pushEnabled: 'push_enabled',
  messagesEnabled: 'messages_enabled',
  connectionsEnabled: 'connections_enabled',
  sessionsEnabled: 'sessions_enabled',
  remindersEnabled: 'reminders_enabled',
  reviewsEnabled: 'reviews_enabled'
});

const typeCategories = Object.freeze({
  message: 'messagesEnabled',
  connection_request: 'connectionsEnabled',
  connection_response: 'connectionsEnabled',
  waitlist_match: 'connectionsEnabled',
  review: 'reviewsEnabled'
});

const ensurePreferences = async (userId) => {
  await db.prepare(`
    INSERT INTO user_notification_preferences (user_id)
    VALUES (?) ON CONFLICT(user_id) DO NOTHING
  `).run(userId);
};

const serializePreferences = (row = {}) => Object.fromEntries(
  Object.entries(preferenceColumns).map(([key, column]) => [key, row[column] === undefined ? DEFAULT_PREFERENCES[key] : Boolean(row[column])])
);

const getNotificationPreferences = async (userId) => {
  await ensurePreferences(userId);
  const row = await db.prepare('SELECT * FROM user_notification_preferences WHERE user_id = ?').get(userId);
  return serializePreferences(row);
};

const updateNotificationPreferences = async (userId, updates) => {
  await ensurePreferences(userId);
  const entries = Object.entries(updates).filter(([key]) => preferenceColumns[key]);
  if (entries.length) {
    const assignments = entries.map(([key]) => `${preferenceColumns[key]} = ?`).join(', ');
    await db.prepare(`
      UPDATE user_notification_preferences
      SET ${assignments}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(...entries.map(([, value]) => (value ? 1 : 0)), userId);
  }
  return getNotificationPreferences(userId);
};

const categoryForType = (type) => {
  if (typeCategories[type]) return typeCategories[type];
  if (String(type).startsWith('session_')) return 'sessionsEnabled';
  return null;
};

const notificationAllowed = (preferences, type, channel = 'inApp') => {
  if (channel === 'email' && !preferences.emailEnabled) return false;
  if (channel === 'push' && !preferences.pushEnabled) return false;
  const category = categoryForType(type);
  return category ? preferences[category] : true;
};

module.exports = {
  DEFAULT_PREFERENCES,
  getNotificationPreferences,
  notificationAllowed,
  preferenceColumns,
  updateNotificationPreferences
};
