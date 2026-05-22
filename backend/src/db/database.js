const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'nextdoorlearn.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
    name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    phone TEXT,
    location TEXT,
    timezone TEXT,
    languages TEXT,
    website TEXT,
    linkedin TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tutor_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subjects TEXT NOT NULL, -- JSON array of subjects
    availability TEXT, -- JSON object with availability
    hourly_rate REAL,
    experience_years INTEGER DEFAULT 0,
    education TEXT,
    certifications TEXT,
    teaching_style TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS student_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    grade_level TEXT,
    subjects_needed TEXT, -- JSON array of subjects
    school TEXT,
    learning_goals TEXT,
    preferred_schedule TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    tutor_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(student_id, tutor_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (connection_id) REFERENCES connections (id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connection_id INTEGER NOT NULL,
    tutor_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    meeting_link TEXT,
    google_event_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (connection_id) REFERENCES connections (id) ON DELETE CASCADE,
    FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    session_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL,
    UNIQUE(tutor_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    related_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tutor_availability_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutor_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_google_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google',
    access_token TEXT,
    refresh_token TEXT,
    token_expiry DATETIME,
    calendar_id TEXT DEFAULT 'primary',
    sync_enabled INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS session_google_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google',
    event_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, user_id, provider),
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tutor_availability_slots_tutor_day
  ON tutor_availability_slots (tutor_id, day_of_week);

  CREATE INDEX IF NOT EXISTS idx_google_integrations_user_provider
  ON user_google_integrations (user_id, provider);

  CREATE INDEX IF NOT EXISTS idx_session_google_events_session_user
  ON session_google_events (session_id, user_id);
`);

// Run migrations to add new columns to existing tables
const migrations = [
  // User table new columns
  { table: 'users', column: 'phone', type: 'TEXT' },
  { table: 'users', column: 'location', type: 'TEXT' },
  { table: 'users', column: 'timezone', type: 'TEXT' },
  { table: 'users', column: 'languages', type: 'TEXT' },
  { table: 'users', column: 'website', type: 'TEXT' },
  { table: 'users', column: 'linkedin', type: 'TEXT' },
  // Tutor profile new columns
  { table: 'tutor_profiles', column: 'experience_years', type: 'INTEGER DEFAULT 0' },
  { table: 'tutor_profiles', column: 'education', type: 'TEXT' },
  { table: 'tutor_profiles', column: 'certifications', type: 'TEXT' },
  { table: 'tutor_profiles', column: 'teaching_style', type: 'TEXT' },
  // Student profile new columns
  { table: 'student_profiles', column: 'school', type: 'TEXT' },
  { table: 'student_profiles', column: 'learning_goals', type: 'TEXT' },
  { table: 'student_profiles', column: 'preferred_schedule', type: 'TEXT' },
  // Sessions new columns
  { table: 'sessions', column: 'google_event_id', type: 'TEXT' },
];

migrations.forEach(({ table, column, type }) => {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
    const columnExists = tableInfo.some(col => col.name === column);
    if (!columnExists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Added column ${column} to ${table}`);
    }
  } catch (error) {
    // Column might already exist or table doesn't exist yet
  }
});

module.exports = db;
