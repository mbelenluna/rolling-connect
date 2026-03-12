/**
 * In-memory store for short-lived speech WebSocket tokens.
 * Uses global store so API routes and server.js share the same Map
 * (Next.js may load this module in a different context).
 * Production: replace with Redis.
 */
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getTokens() {
  if (typeof global !== 'undefined' && global.__speechTokenStore) {
    return global.__speechTokenStore;
  }
  const m = new Map();
  if (typeof global !== 'undefined') global.__speechTokenStore = m;
  return m;
}

function cleanup(tokens) {
  const now = Date.now();
  for (const [k, v] of tokens.entries()) {
    if (v.expiresAt < now) tokens.delete(k);
  }
}

function create(token, data) {
  const tokens = getTokens();
  cleanup(tokens);
  tokens.set(token, { ...data, expiresAt: Date.now() + TTL_MS });
}

function validate(token) {
  const tokens = getTokens();
  cleanup(tokens);
  const entry = tokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) return null;
  tokens.delete(token); // One-time use
  return { role: entry.role, callId: entry.callId };
}

module.exports = { create, validate };
