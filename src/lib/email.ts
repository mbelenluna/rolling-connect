import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM = 'Rolling Translations <info@rolling-translations.com>';
const REPLY_TO = 'info@rolling-translations.com';

function getBaseUrl(): string {
  let url: string;
  if (process.env.NEXTAUTH_URL) {
    url = process.env.NEXTAUTH_URL;
  } else if (process.env.VERCEL_URL) {
    url = `https://${process.env.VERCEL_URL}`;
  } else {
    return 'http://localhost:3000';
  }
  // Ensure production URLs use https (browsers mark http links as unsafe)
  if (url.startsWith('http://') && !url.includes('localhost')) {
    url = url.replace(/^http:\/\//, 'https://');
  }
  return url;
}

export async function sendEmailConfirmation(to: string, name: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const confirmUrl = `${getBaseUrl()}/verify-email/confirm?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Welcome to Rolling Connect!</p>
  
  <p>Please <a href="${escapeHtml(confirmUrl)}" style="color: #2A61B5;">click here</a> to verify your email address and start using your account.</p>
  
  <p>If you are having trouble accessing the link, copy and paste this URL in your browser:</p>
  <p style="word-break: break-all; font-size: 14px;">${escapeHtml(confirmUrl)}</p>
  
  <p>Kind regards,<br>
  Rolling Translations<br>
  Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: 'Confirm your email address – Rolling Connect',
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send confirmation email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { body?: unknown } }).response;
      if (res?.body) console.error('SendGrid response:', res.body);
    }
    return { ok: false, error: msg };
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Dear ${escapeHtml(name)},</p>
  
  <p>Welcome to Rolling Connect, our OPI/VRI platform. We're pleased to have you on board.</p>
  
  <p>To begin using the platform, please complete your payment setup through our secure GoCardless portal at the link below:</p>
  <p><a href="https://pay.gocardless.com/BRT0002QRVBRXRG" style="color: #2A61B5;">https://pay.gocardless.com/BRT0002QRVBRXRG</a></p>
  
  <p>This step is required to activate your account.</p>
  
  <p>Please note:</p>
  <ul>
    <li>We will only deduct payments for calls completed through the platform.</li>
    <li>All charges are fully transparent and can be reviewed at any time in the Billing tab within your account.</li>
    <li>Payments are processed at the end of each week based on usage.</li>
  </ul>
  
  <p>If you already have a contract with Rolling Translations LLC (e.g., governmental or institutional clients), please reply to this email and let us know which contract applies to your account so we can configure your billing profile accordingly.</p>
  
  <p>In that case, kindly send us the full names and email addresses of all individuals who will be using the platform. Each user should register individually, and we will approve their accounts on our end.</p>
  
  <p>If you prefer to use an alternative payment method, please reply to this email and let us know. We will review your request and confirm whether we can accommodate it.</p>
  
  <p>Should you have any questions, we remain at your disposal.</p>
  
  <p>Kind regards,<br>
  Rolling Translations<br>
  Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: 'Welcome to Rolling Connect – Set Up Your Payment Method to Get Started',
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send welcome email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { body?: unknown } }).response;
      if (res?.body) console.error('SendGrid response:', res.body);
    }
    return { ok: false, error: msg };
  }
}

export async function sendContractDetailsToAdmin(
  userEmail: string,
  userName: string,
  contractDetails: string
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>A client has indicated they have an existing contract with Rolling Translations LLC.</p>
  
  <p><strong>User:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</p>
  
  <p><strong>Contract details:</strong></p>
  <pre style="white-space: pre-wrap; background: #f1f5f9; padding: 16px; border-radius: 8px;">${escapeHtml(contractDetails)}</pre>
  
  <p>Please review and approve their account in the admin panel.</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to: 'info@rolling-translations.com',
      from: FROM,
      replyTo: userEmail,
      subject: `Rolling Connect: Contract details from ${userName}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send contract details email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    return { ok: false, error: msg };
  }
}

export async function sendInterpreterWelcomeEmail(to: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Dear ${escapeHtml(name)},</p>
  
  <p>Welcome to Rolling Connect. We appreciate your interest in working with us and look forward to potentially collaborating with you.</p>
  
  <p>To proceed, please review the information below and respond accordingly.</p>
  
  <p><strong>If You Have Already Completed Our Verification &amp; Test Process:</strong></p>
  <p>If you have already passed our verification and interpretation test, please reply to this email confirming this.</p>
  <p>In the same message, kindly indicate your preferred payment method. We currently offer:</p>
  <ul>
    <li>ACH transfer</li>
    <li>Wire transfer to a U.S. bank account</li>
    <li>PayPal</li>
  </ul>
  <p>Please include the necessary payment details so we may set you up in our system. Once confirmed, we will approve your account and activate your profile.</p>
  
  <p><strong>If You Have Not Yet Completed Our Verification Process:</strong></p>
  <p>Please reply to this email with the following information:</p>
  <ul>
    <li>Full name</li>
    <li>Phone number</li>
    <li>Language pair(s) you work with</li>
    <li>Time zone and availability for picking up OPI/VRI calls</li>
    <li>Your CV</li>
  </ul>
  <p>If your profile meets our requirements, you will be invited to complete an interpretation test to assess your skills. Upon successfully passing the test, your account will be approved and you will be able to begin accepting calls immediately.</p>
  
  <p>If you prefer not to proceed, please let us know by replying to this email. We will permanently delete your account from our system.</p>
  
  <p>We appreciate your time and look forward to your response.</p>
  
  <p>Kind regards,<br>
  Rolling Translations<br>
  Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: 'Welcome to Rolling Connect – Next Steps to Activate Your Interpreter Account',
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send interpreter welcome email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { body?: unknown } }).response;
      if (res?.body) console.error('SendGrid response:', res.body);
    }
    return { ok: false, error: msg };
  }
}

export async function sendMfaCode(to: string, name: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Dear ${escapeHtml(name)},</p>
  <p>Your Rolling Connect verification code is:</p>
  <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #2A61B5; background: #f1f5f9; padding: 16px; border-radius: 8px;">${escapeHtml(code)}</p>
  <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  <p>If you did not request this code, please ignore this email or contact us immediately.</p>
  <p>Kind regards,<br>Rolling Translations<br>Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: `${escapeHtml(code)} is your Rolling Connect verification code`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send MFA code email error:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to send' };
  }
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const resetUrl = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Dear ${escapeHtml(name)},</p>
  
  <p>We received a request to reset your password for your Rolling Connect account.</p>
  
  <p>Please <a href="${escapeHtml(resetUrl)}" style="color: #2A61B5;">click here</a> to set a new password. This link will expire in 1 hour.</p>
  
  <p>If you are having trouble accessing the link, copy and paste this URL in your browser:</p>
  <p style="word-break: break-all; font-size: 14px;">${escapeHtml(resetUrl)}</p>
  
  <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  
  <p>Kind regards,<br>
  Rolling Translations<br>
  Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: 'Reset your password – Rolling Connect',
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send password reset email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { body?: unknown } }).response;
      if (res?.body) console.error('SendGrid response:', res.body);
    }
    return { ok: false, error: msg };
  }
}

export async function sendApprovalEmail(
  to: string,
  name: string,
  role: 'client' | 'interpreter'
): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, error: 'SENDGRID_API_KEY not configured' };

  const nextStep =
    role === 'client'
      ? 'You may now start requesting interpretation.'
      : 'You may now start receiving interpretation requests.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 24px;">
  <p>Dear ${escapeHtml(name)},</p>
  
  <p>Your account has been approved! Congratulations.</p>
  
  <p>${nextStep}</p>
  
  <p>Kind regards,<br>
  Rolling Translations<br>
  Rolling Connect Team</p>
</body>
</html>
  `.trim();

  try {
    await sgMail.send({
      to,
      from: FROM,
      replyTo: REPLY_TO,
      subject: 'Your Rolling Connect account has been approved',
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Send approval email error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send';
    if (err && typeof err === 'object' && 'response' in err) {
      const res = (err as { response?: { body?: unknown } }).response;
      if (res?.body) console.error('SendGrid response:', res.body);
    }
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
