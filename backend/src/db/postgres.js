const { Pool, types } = require('pg');
const schema = require('./postgresSchema');

// Keep PostgreSQL response shapes aligned with better-sqlite3.
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const connectionString = process.env.DATABASE_URL;
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || '');
const pool = new Pool({
  connectionString,
  ssl: isLocal || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const quoteCamelCaseAliases = (sql) => sql.replace(/\bAS\s+([a-z][a-z0-9_]*[A-Z][a-zA-Z0-9_]*)\b/g, 'AS "$1"');

const convertPlaceholders = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

const normalizeSql = (source) => {
  let sql = quoteCamelCaseAliases(String(source).trim())
    .replace(/datetime\('now',\s*'-5 minutes'\)/gi, "(CURRENT_TIMESTAMP - INTERVAL '5 minutes')")
    .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/date\('now'\)/gi, 'CURRENT_DATE')
    .replace(/time\('now'\)/gi, 'CURRENT_TIME')
    .replace(/strftime\('%m',\s*([^)]+)\)/gi, "TO_CHAR($1, 'MM')")
    .replace(/strftime\('%Y',\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY')");

  const ignoreConflicts = /^INSERT\s+OR\s+IGNORE\s+INTO/i.test(sql);
  if (ignoreConflicts) sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
  sql = convertPlaceholders(sql);
  if (ignoreConflicts) sql += ' ON CONFLICT DO NOTHING';
  return sql;
};

const statement = (sql, client = pool) => ({
  async all(...params) {
    const result = await client.query(normalizeSql(sql), params);
    return result.rows;
  },
  async get(...params) {
    const result = await client.query(normalizeSql(sql), params);
    return result.rows[0];
  },
  async run(...params) {
    let query = normalizeSql(sql);
    if (/^INSERT\s/i.test(query) && !/\bRETURNING\b/i.test(query)) query += ' RETURNING id';
    const result = await client.query(query, params);
    return {
      changes: result.rowCount,
      lastInsertRowid: result.rows[0]?.id,
    };
  },
});

const db = {
  dialect: 'postgres',
  prepare(sql) {
    return statement(sql);
  },
  async exec(sql) {
    return pool.query(sql);
  },
  async initialize() {
    await pool.query(schema);
  },
  async withTransaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const transactionDb = { prepare: (sql) => statement(sql, client) };
      const result = await callback(transactionDb);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  async close() {
    await pool.end();
  },
};

module.exports = db;
