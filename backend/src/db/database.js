const sqlite = process.env.DATABASE_URL ? null : require('./sqlite');

module.exports = process.env.DATABASE_URL
  ? require('./postgres')
  : sqlite;
