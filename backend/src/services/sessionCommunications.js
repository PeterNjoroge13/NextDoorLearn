const db = require('../db/database');
const { queueEmail } = require('./email');
const emailTemplates = require('./emailTemplates');
const { zonedTimeToUtc } = require('./reminders');

const sessionUrl = () => `${process.env.FRONTEND_URL || 'http://localhost:5173'}/sessions`;

const formatWhen = (session, timezone = 'UTC') => {
  const startsAt = session.starts_at
    ? new Date(session.starts_at)
    : zonedTimeToUtc(session.scheduled_date, session.start_time, timezone);
  try {
    return startsAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone
    });
  } catch {
    return `${session.scheduled_date} at ${String(session.start_time).slice(0, 5)} UTC`;
  }
};

const queueSessionEmails = async (session, event) => {
  const participants = await db.prepare(`
    SELECT id, name, email, timezone FROM users WHERE id IN (?, ?)
  `).all(session.student_id, session.tutor_id);
  const byId = new Map(participants.map((participant) => [Number(participant.id), participant]));
  const student = byId.get(Number(session.student_id));
  const tutor = byId.get(Number(session.tutor_id));
  if (!student || !tutor) return [];

  const recipients = event === 'requested' ? [tutor] : [student, tutor];
  const results = [];
  for (const recipient of recipients) {
    const other = Number(recipient.id) === Number(student.id) ? tutor : student;
    const content = emailTemplates.sessionUpdate({
      event,
      name: recipient.name,
      otherName: other.name,
      title: session.title,
      when: formatWhen(session, recipient.timezone || tutor.timezone || 'UTC'),
      meetingReady: Boolean(session.meeting_link),
      url: sessionUrl()
    });
    results.push(await queueEmail({
      to: recipient.email,
      template: `session_${event}`,
      subject: content.subject,
      text: content.text,
      html: content.html,
      idempotencyKey: `session_${session.id}_${event}_${recipient.id}`
    }));
  }
  return results;
};

module.exports = { formatWhen, queueSessionEmails };
