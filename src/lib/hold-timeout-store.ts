/**
 * In-memory store for OPI caller hold timeout.
 * Maps CallSid -> timeoutAt (ms). Used to show "all interpreters busy" after 60s.
 * For serverless (Vercel): consider Redis. For node server.js: in-memory is fine.
 */
const store = new Map<string, number>();
const TTL_MS = 30 * 60 * 1000; // 30 min - clean up old entries

function cleanup() {
  const now = Date.now();
  Array.from(store.entries()).forEach(([k, v]) => {
    if (v < now) store.delete(k);
  });
}

export function getTimeoutAt(callSid: string): number | undefined {
  cleanup();
  return store.get(callSid);
}

export function setTimeoutAt(callSid: string, timeoutAt: number): void {
  store.set(callSid, timeoutAt);
}

export function extendTimeout(callSid: string, extraMs: number = 60_000): void {
  const now = Date.now();
  const current = store.get(callSid);
  const base = current && current > now ? current : now;
  store.set(callSid, base + extraMs);
}

export function deleteTimeout(callSid: string): void {
  store.delete(callSid);
}
