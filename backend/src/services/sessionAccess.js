const sessionRequiresPayment = (session) => Number(session?.agreed_hourly_rate_cents || 0) > 0;

const studentHasPaid = (session) => !sessionRequiresPayment(session) || session?.payment_status === 'succeeded';

const canOpenMeeting = (session, user) => {
  if (Number(user?.userId) === Number(session?.tutor_id)) return true;
  return Number(user?.userId) === Number(session?.student_id) && studentHasPaid(session);
};

const redactSessionForUser = (session, user) => {
  if (!session) return session;
  const safeSession = { ...session };
  if (Number(user?.userId) === Number(session.student_id) && !studentHasPaid(session)) {
    safeSession.meeting_link = null;
    safeSession.meeting_status = 'payment_required';
  }
  if (Number(user?.userId) !== Number(session.student_id)) {
    delete safeSession.student_reflection;
    delete safeSession.confidence_before;
    delete safeSession.confidence_after;
    delete safeSession.student_submitted_at;
  }
  return safeSession;
};

module.exports = { canOpenMeeting, redactSessionForUser, sessionRequiresPayment, studentHasPaid };
