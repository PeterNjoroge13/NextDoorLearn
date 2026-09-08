const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    const message = `[email:skipped] Email provider is not configured. To: ${to}; Subject: ${subject}`;
    if (process.env.NODE_ENV === 'production') {
      console.warn(message);
      return { id: 'email-skipped', skipped: true };
    }
    console.log(`[email:dev] To: ${to}`);
    console.log(`[email:dev] Subject: ${subject}`);
    console.log(`[email:dev] ${text}`);
    return { id: 'dev-email' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || 'Email send failed');
  }
  return body;
};

module.exports = { sendEmail };
