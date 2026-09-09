const db = require('../src/db/database');

const main = async () => {
  try {
    await db.initialize();
    const result = await db.prepare('SELECT COUNT(*) AS user_count FROM users').get();
    console.log(`Database ready (${db.dialect}); users: ${result.user_count}`);
  } finally {
    await db.close();
  }
};

main().catch((error) => {
  console.error('Database check failed:', error.message || error);
  process.exit(1);
});
