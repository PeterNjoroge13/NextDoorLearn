const db = require('../db/database');

const usersAreBlocked = async (firstUserId, secondUserId, database = db) => Boolean(await database.prepare(`
  SELECT id FROM user_blocks
  WHERE (blocker_id = ? AND blocked_user_id = ?)
     OR (blocker_id = ? AND blocked_user_id = ?)
  LIMIT 1
`).get(firstUserId, secondUserId, secondUserId, firstUserId));

module.exports = { usersAreBlocked };
