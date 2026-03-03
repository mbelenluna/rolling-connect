# Real-Time Event Flow

```
                    CLIENT                    SERVER                     INTERPRETERS
                       |                         |                              |
   Request Now         |                         |                              |
                       |--- POST /requests ------>|                              |
                       |                         |  Matching engine               |
                       |                         |  Create Job (offered)         |
                       |                         |  Notify interpreters          |
                       |<-- 200 { id, jobId } ---|                              |
                       |                         |---- offer_created ----------->| A, B, C
                       |                         |                              |
                       |                         |     Interpreter B accepts    |
                       |                         |<--- POST /accept -------------| B
                       |                         |  Atomic DB update             |
                       |                         |  B wins                       |
                       |                         |---- job_assigned ----------->| B
                       |                         |---- offer_revoked ---------->| A, C
                       |<-- request_status ------|                              |
                       |  (status: assigned)    |                              |
                       |                         |                              |
   Join Call           |                         |                              |
                       |--- GET /call-token ----->|                              |
                       |<-- { roomId, token } ----|                              |
                       |                         |                              |
```

## Socket.io Rooms

- `user:{userId}` — User-specific room for targeted events
- `interpreters` — All online interpreters (for broadcast offers; we use targeted emit to offered list)

## Events

| Event | From | To | When |
|-------|------|-----|------|
| offer_created | Server | Interpreters (offered list) | Job created, interpreters matched |
| job_assigned | Server | Winning interpreter | First successful accept |
| offer_revoked | Server | Other interpreters | Job filled by someone else |
| request_status | Server | Client | Job assigned, status changed |
