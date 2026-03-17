/**
 * JWT-based speech WebSocket token store.
 *
 * Replaced the previous in-memory global store so that the speech
 * WebSocket server can run as a separate Railway service from the
 * main Next.js server. Both services share SPEECH_TOKEN_SECRET and
 * validate tokens cryptographically — no shared memory required.
 *
 * Tokens are HMAC-SHA256 signed JWTs with a 5-minute TTL.
 * They are single-use only at the application level (WebSocket
 * upgrade consumes the token; re-use attempts will still pass
 * signature/expiry checks but the connection will be rejected
 * if the session is already open — acceptable for this use case).
 */
const crypto = require('crypto');

const SECRET = process.env.SPEECH_TOKEN_SECRET || 'dev-secret-change-in-production';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Create a signed JWT speech token containing the given payload data.
 * Returns the token string (replaces the old (token, data) signature).
 */
function create(data) {
  const header  = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({ ...data, exp: Date.now() + TTL_MS });
  const sig = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.${sig}`;
}

/**
 * Validate a signed JWT speech token.
 * Returns { role, callId } on success, null on failure.
 */
function validate(token) {
  try {
    const parts = (token || '').split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;

    // Verify signature
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(`${header}.${payload}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (expected !== sig) return null;

    // Decode and check expiry
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;

    return { role: data.role, callId: data.callId ?? null };
  } catch {
    return null;
  }
}

module.exports = { create, validate };
