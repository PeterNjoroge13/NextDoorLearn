const escapeHtml = (value) => String(value || '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const layout = ({ heading, intro, actionLabel, actionUrl, footer }) => {
  const safeUrl = escapeHtml(actionUrl);
  return `<!doctype html><html><body style="margin:0;background:#f6f4ee;color:#14231f;font-family:Arial,sans-serif"><div style="max-width:600px;margin:0 auto;padding:36px 20px"><div style="font-weight:700;color:#087f72;margin-bottom:24px">NextDoorLearn</div><div style="background:#fff;border:1px solid #dce5e1;padding:32px"><h1 style="font-size:26px;margin:0 0 16px">${escapeHtml(heading)}</h1><p style="line-height:1.6;margin:0 0 24px">${escapeHtml(intro)}</p><a href="${safeUrl}" style="display:inline-block;background:#087f72;color:#fff;text-decoration:none;padding:12px 18px;font-weight:700">${escapeHtml(actionLabel)}</a><p style="font-size:13px;line-height:1.5;color:#61716b;margin:24px 0 0">${escapeHtml(footer)}</p></div></div></body></html>`;
};

const actionEmail = ({ heading, intro, actionLabel, actionUrl, footer }) => ({
  text: `${heading}\n\n${intro}\n\n${actionLabel}: ${actionUrl}\n\n${footer}`,
  html: layout({ heading, intro, actionLabel, actionUrl, footer })
});

module.exports = {
  verification(name, url) {
    return actionEmail({
      heading: 'Verify your email',
      intro: `Hi ${name || 'there'}, confirm your email address to finish securing your NextDoorLearn account.`,
      actionLabel: 'Verify email', actionUrl: url,
      footer: 'This link expires in 48 hours. Ignore this message if you did not create an account.'
    });
  },
  passwordReset(name, url) {
    return actionEmail({
      heading: 'Reset your password',
      intro: `Hi ${name || 'there'}, use this secure link to choose a new NextDoorLearn password.`,
      actionLabel: 'Reset password', actionUrl: url,
      footer: 'This link expires in 2 hours. Ignore this message if you did not request a reset.'
    });
  },
  tutorActivation(name, url) {
    return actionEmail({
      heading: 'Your tutor application was approved',
      intro: `Hi ${name}, welcome to NextDoorLearn. Set your password to activate your approved tutor account and finish your public profile.`,
      actionLabel: 'Activate tutor account', actionUrl: url,
      footer: 'This invitation expires in 72 hours and can only be used once.'
    });
  },
  tutorApplicationReceived(name, url) {
    return actionEmail({
      heading: 'We received your tutor application',
      intro: `Hi ${name}, thank you for offering your time and knowledge. Our team will review your application and email you with the next step.`,
      actionLabel: 'Visit NextDoorLearn', actionUrl: url,
      footer: 'You do not need to create a separate tutor account while your application is under review.'
    });
  },
  tutorApplicationAdminAlert({ name, email, subjects, location, hourlyRate, url }) {
    const rate = Number(hourlyRate || 0) === 0 ? 'volunteer tutoring' : `$${Number(hourlyRate).toFixed(2)}/hour tutoring`;
    return actionEmail({
      heading: 'New tutor application to review',
      intro: `${name} (${email}) applied to offer ${rate}${location ? ` from ${location}` : ''}. Subjects: ${subjects.join(', ') || 'not listed'}.`,
      actionLabel: 'Review tutor application', actionUrl: url,
      footer: 'Sign in with an administrator account to review, approve, request information, or decline this application.'
    });
  },
  safetyReportAdminAlert({ reporterName, reporterEmail, reportedName, reportedEmail, reason, url }) {
    return actionEmail({
      heading: 'New safety report to review',
      intro: `${reporterName} (${reporterEmail}) reported ${reportedName} (${reportedEmail}) for “${reason}”. Review the report promptly and record the moderation outcome.`,
      actionLabel: 'Review safety report', actionUrl: url,
      footer: 'Reports may involve students under 18. Keep details private and escalate immediate danger to the appropriate emergency service.'
    });
  },
  tutorApplicationDecision(name, state, reason, url) {
    const needsInfo = state === 'needs_information';
    return actionEmail({
      heading: needsInfo ? 'We need more information' : 'Update on your tutor application',
      intro: `Hi ${name}, ${needsInfo ? 'we need a little more information before completing our review' : 'we are unable to approve your tutor application at this time'}.${reason ? ` ${reason}` : ''}`,
      actionLabel: needsInfo ? 'Review tutor application' : 'Visit NextDoorLearn', actionUrl: url,
      footer: needsInfo ? 'Reply to the NextDoorLearn team with the requested information.' : 'Thank you for your interest in supporting students.'
    });
  },
  sessionReminder(name, title, when, otherName, url, meetingReady = false) {
    return actionEmail({
      heading: `Upcoming session: ${title}`,
      intro: `Hi ${name}, your tutoring session with ${otherName} is scheduled for ${when}.${meetingReady ? ' Your secure meeting room is ready on the session page.' : ''}`,
      actionLabel: 'View session', actionUrl: url,
      footer: 'Open NextDoorLearn to review the meeting details or make a change.'
    });
  },
  sessionUpdate({ event, name, otherName, title, when, meetingReady, url }) {
    const content = {
      requested: {
        heading: 'New tutoring session request',
        subject: `Session request: ${title}`,
        intro: `Hi ${name}, ${otherName} requested "${title}" for ${when}. Open NextDoorLearn to confirm or decline the request.`,
        actionLabel: 'Review request',
        footer: 'A meeting room and calendar event are created only after the tutor confirms the session.'
      },
      confirmed: {
        heading: 'Your tutoring session is confirmed',
        subject: `Confirmed: ${title}`,
        intro: `Hi ${name}, your session "${title}" with ${otherName} is confirmed for ${when}.${meetingReady ? ' The secure meeting room is ready on the session page.' : ''}`,
        actionLabel: 'View session',
        footer: 'Keep meeting links private and join from the NextDoorLearn session page.'
      },
      declined: {
        heading: 'Session request declined',
        subject: `Session update: ${title}`,
        intro: `Hi ${name}, the request for "${title}" with ${otherName} at ${when} was declined. You can choose another available time in NextDoorLearn.`,
        actionLabel: 'View schedule',
        footer: 'No calendar event or meeting room was created for this request.'
      },
      cancelled: {
        heading: 'Tutoring session cancelled',
        subject: `Cancelled: ${title}`,
        intro: `Hi ${name}, the session "${title}" with ${otherName}, previously planned for ${when}, was cancelled.`,
        actionLabel: 'View schedule',
        footer: 'The connected calendar event and managed meeting room have been removed.'
      },
      reschedule_requested: {
        heading: 'A new session time needs confirmation',
        subject: `New time requested: ${title}`,
        intro: `Hi ${name}, ${otherName} proposed a new time for "${title}": ${when}. Open NextDoorLearn to confirm or decline it.`,
        actionLabel: 'Review new time',
        footer: 'Calendar and meeting details will be recreated after the tutor confirms the new time.'
      },
      rescheduled: {
        heading: 'Your tutoring session was rescheduled',
        subject: `Rescheduled: ${title}`,
        intro: `Hi ${name}, "${title}" with ${otherName} is now scheduled for ${when}.${meetingReady ? ' The secure meeting room has been refreshed.' : ''}`,
        actionLabel: 'View updated session',
        footer: 'Your connected calendar and reminders have been updated.'
      }
    }[event];
    const email = actionEmail({
      heading: content.heading,
      intro: content.intro,
      actionLabel: content.actionLabel,
      actionUrl: url,
      footer: content.footer
    });
    return { subject: content.subject, ...email };
  }
};
