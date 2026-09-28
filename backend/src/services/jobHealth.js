const db = require('../db/database');

const JOB_NAME = 'scheduled_operations';
const LEASE_MINUTES = 15;
const HEALTHY_MINUTES = Number(process.env.JOB_HEALTHY_WINDOW_MINUTES || 30);

const asUtcDate = (value) => {
  if (!value) return null;
  const text = String(value);
  return new Date(/[zZ]|[+-]\d\d(?::?\d\d)?$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
};

const startBackgroundJobRun = async () => {
  const staleBefore = new Date(Date.now() - LEASE_MINUTES * 60 * 1000).toISOString();
  return db.withTransaction(async (transaction) => {
    await transaction.prepare(`
      UPDATE background_job_runs SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
        error = 'Worker lease expired before completion'
      WHERE job_name = ? AND status = 'running' AND started_at <= ?
    `).run(JOB_NAME, staleBefore);
    const active = await transaction.prepare(`
      SELECT id FROM background_job_runs
      WHERE job_name = ? AND status = 'running'
      ORDER BY started_at DESC LIMIT 1
    `).get(JOB_NAME);
    if (active) return null;
    const result = await transaction.prepare(`
      INSERT INTO background_job_runs (job_name, status) VALUES (?, 'running')
    `).run(JOB_NAME);
    return result.lastInsertRowid;
  });
};

const completeBackgroundJobRun = async (id, { status, error = null, details = null }) => {
  await db.prepare(`
    UPDATE background_job_runs SET status = ?, completed_at = CURRENT_TIMESTAMP, error = ?, details = ?
    WHERE id = ? AND status = 'running'
  `).run(status, error ? String(error).slice(0, 500) : null, details ? JSON.stringify(details) : null, id);
  await db.prepare(`
    DELETE FROM background_job_runs
    WHERE job_name = ? AND id NOT IN (
      SELECT id FROM background_job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 500
    )
  `).run(JOB_NAME, JOB_NAME);
};

const getBackgroundJobHealth = async () => {
  const latest = await db.prepare(`
    SELECT id, status, started_at, completed_at, error, details
    FROM background_job_runs WHERE job_name = ? ORDER BY id DESC LIMIT 1
  `).get(JOB_NAME);
  if (!latest) return { status: 'never_run', healthy: false, ageMinutes: null, lastCompletedAt: null };
  const reference = asUtcDate(latest.completed_at || latest.started_at);
  const ageMinutes = reference && !Number.isNaN(reference.getTime())
    ? Math.max(0, Math.round((Date.now() - reference.getTime()) / 60000))
    : null;
  return {
    status: latest.status,
    healthy: latest.status === 'completed' && ageMinutes !== null && ageMinutes <= HEALTHY_MINUTES,
    ageMinutes,
    lastCompletedAt: latest.completed_at || null,
    error: latest.error || null
  };
};

module.exports = { completeBackgroundJobRun, getBackgroundJobHealth, startBackgroundJobRun };
