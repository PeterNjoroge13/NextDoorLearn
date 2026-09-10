const migrations = [
  {
    version: '001_platform_safety_foundation',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'tutor_applications', 'reviewed_by', `${userId} REFERENCES users(id) ON DELETE SET NULL`);
      await addColumn(db, 'tutor_applications', 'reviewed_at', timestamp);
      await addColumn(db, 'tutor_applications', 'decision_reason', 'TEXT');
      await addColumn(db, 'tutor_applications', 'internal_notes', 'TEXT');
      await addColumn(db, 'tutor_applications', 'activation_status', "TEXT DEFAULT 'not_invited'");
      await addColumn(db, 'tutor_applications', 'invitation_sent_at', timestamp);
      await addColumn(db, 'tutor_applications', 'activated_user_id', `${userId} REFERENCES users(id) ON DELETE SET NULL`);

      await addColumn(db, 'sessions', 'requested_by', `${userId} REFERENCES users(id) ON DELETE SET NULL`);
      await addColumn(db, 'sessions', 'confirmation_status', "TEXT DEFAULT 'confirmed'");
      await addColumn(db, 'sessions', 'starts_at', timestamp);
      await addColumn(db, 'sessions', 'ends_at', timestamp);
      await addColumn(db, 'sessions', 'cancelled_by', `${userId} REFERENCES users(id) ON DELETE SET NULL`);
      await addColumn(db, 'sessions', 'cancellation_reason', 'TEXT');

      await db.exec(`
        CREATE TABLE IF NOT EXISTS admin_memberships (
          id ${id},
          user_id ${userId} NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          permission_level TEXT NOT NULL DEFAULT 'admin',
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id ${id},
          admin_user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id ${userId},
          details TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tutor_activation_tokens (
          id ${id},
          application_id ${userId} NOT NULL REFERENCES tutor_applications(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at ${timestamp} NOT NULL,
          used_at ${timestamp},
          revoked_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_outbox (
          id ${id},
          recipient TEXT NOT NULL,
          template TEXT NOT NULL,
          subject TEXT NOT NULL,
          text_body TEXT NOT NULL,
          html_body TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'pending',
          provider_id TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          last_error TEXT,
          sent_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_delivery_events (
          id ${id},
          provider_event_id TEXT UNIQUE,
          provider_email_id TEXT,
          event_type TEXT NOT NULL,
          payload TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_blocks (
          id ${id},
          blocker_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reason TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(blocker_id, blocked_user_id)
        );

        CREATE TABLE IF NOT EXISTS moderation_actions (
          id ${id},
          report_id ${userId} REFERENCES user_reports(id) ON DELETE SET NULL,
          subject_user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          admin_user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          action TEXT NOT NULL,
          reason TEXT NOT NULL,
          expires_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS session_reminders (
          id ${id},
          session_id ${userId} NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reminder_type TEXT NOT NULL,
          scheduled_for ${timestamp} NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_id, user_id, reminder_type)
        );
      `);

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_tutor_activation_application ON tutor_activation_tokens(application_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_email_outbox_pending ON email_outbox(status, next_attempt_at);
        CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id, blocked_user_id);
        CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_user_id, blocker_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_subject ON moderation_actions(subject_user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_session_reminders_due ON session_reminders(status, scheduled_for);
      `);
    }
  },
  {
    version: '002_tutor_review_state',
    async up(db) {
      await addColumn(db, 'tutor_applications', 'review_state', "TEXT DEFAULT 'submitted'");
      await db.exec(`
        UPDATE tutor_applications SET review_state = CASE status
          WHEN 'pending' THEN 'submitted'
          WHEN 'reviewing' THEN 'reviewing'
          WHEN 'approved' THEN 'approved'
          WHEN 'declined' THEN 'declined'
          ELSE 'submitted'
        END
        WHERE review_state IS NULL OR review_state = 'submitted'
      `);
    }
  },
  {
    version: '003_backfill_existing_tutors',
    async up(db) {
      await db.exec(`
        UPDATE users SET verified_at = COALESCE(verified_at, created_at)
        WHERE role = 'tutor' AND verified_at IS NULL
      `);
    }
  }
];

const addColumn = async (db, table, column, definition) => {
  if (db.dialect === 'postgres') {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    return;
  }
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const runMigrations = async (db) => {
  const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id ${id},
      version TEXT NOT NULL UNIQUE,
      applied_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of migrations) {
    const applied = await db.prepare('SELECT id FROM schema_migrations WHERE version = ?').get(migration.version);
    if (applied) continue;
    await db.withTransaction(async (transaction) => {
      await migration.up(transaction);
      await transaction.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
    });
    console.log(`Applied database migration ${migration.version}`);
  }
};

module.exports = { runMigrations };
