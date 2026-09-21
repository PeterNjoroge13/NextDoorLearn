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
  },
  {
    version: '004_session_learning_outcomes',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'sessions', 'completed_at', timestamp);
      await addColumn(db, 'sessions', 'completed_by', `${userId} REFERENCES users(id) ON DELETE SET NULL`);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS session_outcomes (
          id ${id},
          session_id ${userId} NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
          tutor_summary TEXT,
          skills_practiced TEXT,
          next_steps TEXT,
          student_reflection TEXT,
          confidence_before INTEGER CHECK (confidence_before BETWEEN 1 AND 5),
          confidence_after INTEGER CHECK (confidence_after BETWEEN 1 AND 5),
          tutor_submitted_at ${timestamp},
          student_submitted_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_session_outcomes_session ON session_outcomes(session_id);
      `);
    }
  },
  {
    version: '005_waitlist_matching_workspace',
    async up(db) {
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'student_waitlist_entries', 'matched_tutor_id', `${userId} REFERENCES users(id) ON DELETE SET NULL`);
      await addColumn(db, 'student_waitlist_entries', 'matched_by', `${userId} REFERENCES users(id) ON DELETE SET NULL`);
      await addColumn(db, 'student_waitlist_entries', 'matched_at', timestamp);
      await addColumn(db, 'student_waitlist_entries', 'contacted_at', timestamp);
      await addColumn(db, 'student_waitlist_entries', 'admin_notes', 'TEXT');

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_waitlist_status_updated ON student_waitlist_entries(status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_waitlist_matched_tutor ON student_waitlist_entries(matched_tutor_id);
      `);
    }
  },
  {
    version: '006_mobile_foundation',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await db.exec(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id ${id},
          user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          device_name TEXT,
          expires_at ${timestamp} NOT NULL,
          revoked_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          last_used_at ${timestamp}
        );

        CREATE TABLE IF NOT EXISTS push_devices (
          id ${id},
          user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expo_push_token TEXT NOT NULL UNIQUE,
          platform TEXT NOT NULL,
          device_name TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          last_seen_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at);
        CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id, enabled);
      `);
    }
  },
  {
    version: '007_session_security',
    async up(db) {
      await addColumn(db, 'users', 'session_version', 'INTEGER NOT NULL DEFAULT 0');
    }
  },
  {
    version: '008_persistent_media',
    async up(db) {
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';
      const binary = db.dialect === 'postgres' ? 'BYTEA' : 'BLOB';
      await db.exec(`
        CREATE TABLE IF NOT EXISTS media_assets (
          id TEXT PRIMARY KEY,
          owner_user_id ${userId} REFERENCES users(id) ON DELETE CASCADE,
          application_id ${userId} REFERENCES tutor_applications(id) ON DELETE SET NULL,
          kind TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          data ${binary} NOT NULL,
          byte_size INTEGER NOT NULL,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets(owner_user_id, kind);
        CREATE INDEX IF NOT EXISTS idx_media_assets_application ON media_assets(application_id);
      `);
    }
  },
  {
    version: '009_policy_acceptance',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'users', 'age_group', 'TEXT');
      await addColumn(db, 'tutor_applications', 'policy_version', 'TEXT');
      await addColumn(db, 'tutor_applications', 'adult_confirmed_at', timestamp);
      await addColumn(db, 'tutor_applications', 'terms_accepted_at', timestamp);
      await addColumn(db, 'tutor_applications', 'privacy_accepted_at', timestamp);
      await addColumn(db, 'tutor_applications', 'safety_accepted_at', timestamp);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS policy_acceptances (
          id ${id},
          user_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          policy_type TEXT NOT NULL,
          policy_version TEXT NOT NULL,
          source TEXT NOT NULL,
          user_agent TEXT,
          accepted_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, policy_type, policy_version)
        );
        CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user ON policy_acceptances(user_id, accepted_at);
      `);
    }
  },
  {
    version: '010_managed_video_meetings',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await db.exec(`
        CREATE TABLE IF NOT EXISTS session_meetings (
          id ${id},
          session_id ${userId} NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
          provider TEXT NOT NULL,
          provider_meeting_id TEXT UNIQUE,
          host_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          last_error TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_session_meetings_provider_id
          ON session_meetings(provider, provider_meeting_id);
      `);
    }
  },
  {
    version: '011_session_lifecycle_history',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'sessions', 'reschedule_count', 'INTEGER NOT NULL DEFAULT 0');
      await addColumn(db, 'sessions', 'last_rescheduled_at', timestamp);
      await db.exec(`
        CREATE TABLE IF NOT EXISTS session_events (
          id ${id},
          session_id ${userId} NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          actor_user_id ${userId} REFERENCES users(id) ON DELETE SET NULL,
          event_type TEXT NOT NULL,
          from_state TEXT,
          to_state TEXT,
          details TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_session_events_session
          ON session_events(session_id, created_at);
      `);
    }
  },
  {
    version: '012_session_timezone',
    async up(db) {
      await addColumn(db, 'sessions', 'session_timezone', "TEXT NOT NULL DEFAULT 'UTC'");
      await db.exec(`
        UPDATE sessions
        SET session_timezone = COALESCE(
          (SELECT timezone FROM users WHERE users.id = sessions.tutor_id),
          'UTC'
        )
        WHERE session_timezone IS NULL OR session_timezone = 'UTC'
      `);
    }
  },
  {
    version: '013_affordable_rate_cap',
    async up(db) {
      await db.exec('UPDATE tutor_profiles SET hourly_rate = 25 WHERE hourly_rate > 25');
      await db.exec('UPDATE tutor_applications SET hourly_rate = 25 WHERE hourly_rate > 25');
      await db.exec(`
        UPDATE student_profiles
        SET budget_preference = 'flexible'
        WHERE budget_preference IS NOT NULL
          AND LOWER(budget_preference) NOT IN ('free', 'under-10', 'under-15', 'under-20', 'under-25', 'flexible')
      `);
      await db.exec(`
        UPDATE student_waitlist_entries
        SET budget_preference = 'flexible'
        WHERE budget_preference IS NOT NULL
          AND LOWER(budget_preference) NOT IN ('free', 'under-10', 'under-15', 'under-20', 'under-25', 'flexible')
      `);
    }
  },
  {
    version: '014_notification_preferences',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';
      await db.exec(`
        CREATE TABLE IF NOT EXISTS user_notification_preferences (
          id ${id},
          user_id ${userId} NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          email_enabled INTEGER NOT NULL DEFAULT 1,
          push_enabled INTEGER NOT NULL DEFAULT 1,
          messages_enabled INTEGER NOT NULL DEFAULT 1,
          connections_enabled INTEGER NOT NULL DEFAULT 1,
          sessions_enabled INTEGER NOT NULL DEFAULT 1,
          reminders_enabled INTEGER NOT NULL DEFAULT 1,
          reviews_enabled INTEGER NOT NULL DEFAULT 1,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
          ON user_notification_preferences(user_id);
      `);
    }
  },
  {
    version: '015_marketplace_payments',
    async up(db) {
      const id = db.dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
      const userId = db.dialect === 'postgres' ? 'BIGINT' : 'INTEGER';
      const timestamp = db.dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME';

      await addColumn(db, 'sessions', 'agreed_hourly_rate_cents', 'INTEGER NOT NULL DEFAULT 0');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS tutor_payment_accounts (
          id ${id},
          user_id ${userId} NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL DEFAULT 'stripe',
          provider_account_id TEXT NOT NULL UNIQUE,
          onboarding_status TEXT NOT NULL DEFAULT 'pending',
          charges_enabled INTEGER NOT NULL DEFAULT 0,
          payouts_enabled INTEGER NOT NULL DEFAULT 0,
          details_submitted INTEGER NOT NULL DEFAULT 0,
          requirements_due TEXT,
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS session_payments (
          id ${id},
          session_id ${userId} NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
          student_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tutor_id ${userId} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider TEXT NOT NULL DEFAULT 'stripe',
          provider_payment_intent_id TEXT UNIQUE,
          provider_charge_id TEXT,
          amount_cents INTEGER NOT NULL,
          platform_fee_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'usd',
          status TEXT NOT NULL DEFAULT 'pending',
          failure_code TEXT,
          failure_message TEXT,
          paid_at ${timestamp},
          refunded_at ${timestamp},
          created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
          updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payment_events (
          id ${id},
          provider_event_id TEXT NOT NULL UNIQUE,
          event_type TEXT NOT NULL,
          object_id TEXT,
          processed_at ${timestamp} DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tutor_payment_accounts_status
          ON tutor_payment_accounts(onboarding_status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_session_payments_tutor
          ON session_payments(tutor_id, status, created_at);
        CREATE INDEX IF NOT EXISTS idx_session_payments_student
          ON session_payments(student_id, status, created_at);
      `);

      const paidSessions = await db.prepare(`
        SELECT sessions.id, tutor_profiles.hourly_rate
        FROM sessions
        LEFT JOIN tutor_profiles ON tutor_profiles.user_id = sessions.tutor_id
      `).all();
      for (const session of paidSessions) {
        const rate = Math.max(0, Math.min(25, Number(session.hourly_rate) || 0));
        await db.prepare('UPDATE sessions SET agreed_hourly_rate_cents = ? WHERE id = ?')
          .run(Math.round(rate * 100), session.id);
      }
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
