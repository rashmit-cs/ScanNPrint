const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

async function sendViaBrevo({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      sender: parseFrom(process.env.MAIL_FROM),
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body}`);
  }
  return true;
}

// MAIL_FROM is stored as: "ScanNPrint <tech.support.dev@gmail.com>" — Brevo's API wants
// { name, email } separately rather than that combined string.
function parseFrom(raw) {
  const match = /^"?([^"<]*)"?\s*<([^>]+)>$/.exec((raw || '').trim());
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw };
}

export async function sendOtpEmail(to, otp, name) {
  const html = `
    <div style="font-family:sans-serif;max-width:420px;margin:0 auto;background:#0A0A0F;color:#F5F0E8;padding:32px;border-radius:16px;">
      <h2 style="color:#FF5C00;margin-bottom:8px;">ScanNPrint</h2>
      <p>Hi ${name},</p>
      <p>Your email verification code:</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:10px;background:#1a1a1f;padding:20px;text-align:center;border-radius:12px;margin:16px 0;">
        ${otp}
      </div>
      <p style="color:#888;font-size:13px;">Valid for 10 minutes. Do not share this with anyone.</p>
      <hr style="border-color:#333;margin:20px 0;"/>
      <p style="color:#888;font-size:12px;">If you didn't sign up for ScanNPrint, ignore this email.</p>
    </div>`;

  if (!process.env.BREVO_API_KEY) {
    console.log(`\n${'='.repeat(50)}\n[DEV] OTP for ${to} (${name}): ${otp}\n${'='.repeat(50)}\n`);
    return false;
  }
  try {
    await sendViaBrevo({ to, subject: 'Your ScanNPrint verification code', html });
    return true;
  } catch (e) {
    console.error('Email error:', e.message);
    console.log(`\n[FALLBACK OTP] ${to}: ${otp}\n`);
    return false;
  }
}

export async function sendPasswordResetEmail(to, resetLink, name) {
  const html = `
    <div style="font-family:sans-serif;max-width:420px;margin:0 auto;background:#0A0A0F;color:#F5F0E8;padding:32px;border-radius:16px;">
      <h2 style="color:#FF5C00;margin-bottom:8px;">ScanNPrint</h2>
      <p>Hi ${name || 'there'},</p>
      <p>Click below to reset your password. This link expires in 30 minutes.</p>
      <a href="${resetLink}" style="display:inline-block;background:#FF5C00;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;margin:16px 0;">Reset Password</a>
      <p style="color:#888;font-size:13px;">If you didn't request this, ignore this email — your password won't change.</p>
      <hr style="border-color:#333;margin:20px 0;"/>
      <p style="color:#888;font-size:12px;">Need help? ${process.env.SUPPORT_EMAIL || ''}</p>
    </div>`;

  if (!process.env.BREVO_API_KEY) {
    console.log(`\n${'='.repeat(50)}\n[DEV] Password reset link for ${to}: ${resetLink}\n${'='.repeat(50)}\n`);
    return false;
  }
  try {
    await sendViaBrevo({ to, subject: 'Reset your ScanNPrint password', html });
    return true;
  } catch (e) {
    console.error('Email error:', e.message);
    console.log(`\n[FALLBACK RESET LINK] ${to}: ${resetLink}\n`);
    return false;
  }
}