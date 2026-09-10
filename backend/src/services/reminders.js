const db = require('../db/database');
const { queueEmail } = require('./email');
const emailTemplates = require('./emailTemplates');

const zonedTimeToUtc = (date, time, timeZone = 'UTC') => {
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number);
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    return new Date(guess - (represented - guess));
  } catch {
    return new Date(guess);
  }
};

const scheduleSessionReminders = async (session) => {
  const tutor = await db.prepare('SELECT timezone FROM users WHERE id = ?').get(session.tutor_id);
  const startsAt = zonedTimeToUtc(session.scheduled_date, session.start_time, tutor?.timezone || 'UTC');
  const endsAt = zonedTimeToUtc(session.scheduled_date, session.end_time, tutor?.timezone || 'UTC');
  await db.prepare('UPDATE sessions SET starts_at = ?, ends_at = ? WHERE id = ?').run(startsAt.toISOString(), endsAt.toISOString(), session.id);

  for (const userId of [session.student_id, session.tutor_id]) {
    for (const [type, hours] of [['24_hour', 24], ['1_hour', 1]]) {
      const scheduledFor = new Date(startsAt.getTime() - hours * 60 * 60 * 1000);
      if (scheduledFor <= new Date()) continue;
      await db.prepare(`
        INSERT INTO session_reminders (session_id, user_id, reminder_type, scheduled_for)
        VALUES (?, ?, ?, ?) ON CONFLICT(session_id, user_id, reminder_type)
        DO UPDATE SET scheduled_for = excluded.scheduled_for, status = 'pending', sent_at = NULL
      `).run(session.id, userId, type, scheduledFor.toISOString());
    }
  }
};

const processSessionReminders = async (limit = 50) => {
  const reminders = await db.prepare(`
    SELECT sr.*, s.title, s.starts_at, s.student_id, s.tutor_id,
      recipient.name AS recipient_name, recipient.email AS recipient_email,
      student.name AS student_name, tutor.name AS tutor_name
    FROM session_reminders sr
    JOIN sessions s ON s.id = sr.session_id
    JOIN users recipient ON recipient.id = sr.user_id
    JOIN users student ON student.id = s.student_id
    JOIN users tutor ON tutor.id = s.tutor_id
    WHERE sr.status = 'pending' AND sr.scheduled_for <= CURRENT_TIMESTAMP
      AND s.status = 'scheduled' AND s.confirmation_status = 'confirmed'
    ORDER BY sr.scheduled_for ASC LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 100));

  let sent = 0;
  for (const reminder of reminders) {
    const otherName = Number(reminder.user_id) === Number(reminder.student_id) ? reminder.tutor_name : reminder.student_name;
    const when = new Date(reminder.starts_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
    const content = emailTemplates.sessionReminder(reminder.recipient_name, reminder.title, `${when} UTC`, otherName, `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sessions`);
    const email = await queueEmail({
      to: reminder.recipient_email,
      template: `session_reminder_${reminder.reminder_type}`,
      subject: `${reminder.reminder_type === '1_hour' ? 'Starting soon' : 'Tomorrow'}: ${reminder.title}`,
      ...content,
      idempotencyKey: `session_${reminder.session_id}_${reminder.user_id}_${reminder.reminder_type}`
    });
    if (email?.status === 'sent') {
      await db.prepare("UPDATE session_reminders SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(reminder.id);
      sent += 1;
    }
  }
  return { processed: reminders.length, sent };
};

module.exports = { scheduleSessionReminders, processSessionReminders, zonedTimeToUtc };
