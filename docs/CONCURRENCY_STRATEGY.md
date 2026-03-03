# Rolling Connect — First-Accept-Wins Concurrency Strategy

## Problem

Multiple interpreters may click "Accept" within milliseconds. Only one must win. Others must receive "Already assigned."

## Solution: Database Row Lock + Atomic Update

### Approach: `SELECT ... FOR UPDATE` + Conditional Update

```sql
-- In a single transaction:
BEGIN;

-- 1. Lock the job row (blocks other interpreters)
SELECT id, status, assigned_interpreter_id
FROM jobs
WHERE id = :job_id
  AND status = 'offered'
FOR UPDATE;

-- 2. If row exists and status is still 'offered':
UPDATE jobs
SET status = 'assigned',
    assigned_interpreter_id = :interpreter_id,
    updated_at = NOW()
WHERE id = :job_id
  AND status = 'offered';

-- 3. Check rows affected
-- If 1 row updated → SUCCESS (this interpreter won)
-- If 0 rows updated → ALREADY_ASSIGNED (someone else won or expired)

COMMIT;
```

### Why This Works

1. **`FOR UPDATE`** places an exclusive row lock. Any other transaction trying to `SELECT ... FOR UPDATE` on the same row will block until the first transaction commits or rolls back.
2. **Conditional UPDATE** (`WHERE status = 'offered'`) ensures that even if two transactions somehow both acquired locks (e.g., different DB replicas), only the first update would succeed.
3. **Single transaction** keeps the operation atomic.

### Alternative: Optimistic Locking with Version

```sql
UPDATE jobs
SET status = 'assigned',
    assigned_interpreter_id = :interpreter_id,
    version = version + 1,
    updated_at = NOW()
WHERE id = :job_id
  AND status = 'offered'
  AND version = :expected_version;

-- Check affected rows: 1 = success, 0 = lost race
```

### Distributed Lock (Redis) — Optional for Multi-Region

If the app runs across multiple regions with different DB replicas:

```
1. Interpreter A: Redis SET job:123:lock <interpreter_id> NX EX 5
   → Success: proceed to DB update
   → Fail: key exists → ALREADY_ASSIGNED

2. DB update (same as above)

3. Redis DEL job:123:lock (release)
```

For single-region MVP, DB row lock is sufficient.

## Implementation Checklist

- [x] Use Prisma transaction with `$transaction`
- [x] Use raw SQL or Prisma's `findFirst` + `update` in transaction
- [x] Return clear result: `{ success: true, job }` or `{ success: false, error: 'ALREADY_ASSIGNED' }`
- [x] On success: emit `job_assigned` to winner, `offer_revoked` to others via WebSocket
- [x] On failure: return immediately, no side effects
