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
  tutorApplicationDecision(name, state, reason, url) {
    const needsInfo = state === 'needs_information';
    return actionEmail({
      heading: needsInfo ? 'We need more information' : 'Update on your tutor application',
      intro: `Hi ${name}, ${needsInfo ? 'we need a little more information before completing our review' : 'we are unable to approve your tutor application at this time'}.${reason ? ` ${reason}` : ''}`,
      actionLabel: needsInfo ? 'Review tutor application' : 'Visit NextDoorLearn', actionUrl: url,
      footer: needsInfo ? 'Reply to the NextDoorLearn team with the requested information.' : 'Thank you for your interest in supporting students.'
    });
  },
  sessionReminder(name, title, when, otherName, url) {
    return actionEmail({
      heading: `Upcoming session: ${title}`,
      intro: `Hi ${name}, your tutoring session with ${otherName} is scheduled for ${when}.`,
      actionLabel: 'View session', actionUrl: url,
      footer: 'Open NextDoorLearn to review the meeting details or make a change.'
    });
  }
};
