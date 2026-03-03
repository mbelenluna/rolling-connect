import { createHmac } from 'crypto';

const SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production';

/** Create a signed invite token for a call (valid 1 hour) */
export function createInviteToken(callId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  const payload = `${callId}:${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/** Verify invite token and return callId if valid */
export function verifyInviteToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    const callId = parts[0];
    const expStr = parts[1];
    const sig = parts.slice(2).join(':');
    if (!callId || !expStr || !sig) return null;
    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() / 1000 > exp) return null;
    const payload = `${callId}:${expStr}`;
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    if (sig !== expected) return null;
    return callId;
  } catch {
    return null;
  }
}
