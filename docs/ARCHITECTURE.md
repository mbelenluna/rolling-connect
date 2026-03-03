# Rolling Connect — System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                                │
├──────────────┬──────────────┬──────────────┬────────────────────────────────┤
│ Client Portal │ Interpreter  │ Admin Portal │  (Next.js App Router)          │
│ /client/*    │ Portal       │ /admin/*     │                                │
│              │ /interpreter/*│              │                                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Next.js API Routes)                       │
│  REST + WebSocket (Socket.io)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┐
│ Auth Service │ Matching     │ Job Dispatch │ Call Service │ Billing Service  │
│ (NextAuth)   │ Engine       │ (Atomic)     │ (WebRTC)     │                  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (Prisma ORM)                              │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Redis (optional): job queue, distributed lock, session cache                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: First-Accept Wins

```
Client submits request
        │
        ▼
Matching Engine filters interpreters (online, language, specialty, etc.)
        │
        ▼
Create Job record (status: PENDING)
        │
        ▼
Send offer_created to ALL matched interpreters (WebSocket + Email)
        │
        ▼
Interpreter A clicks Accept ──► DB Transaction: SELECT FOR UPDATE
        │                              │
        │                              ├─ If job still PENDING: UPDATE to ASSIGNED, set interpreter_id
        │                              │  → Success: send job_assigned to A, offer_revoked to B,C,D
        │                              │
        │                              └─ If already ASSIGNED: Return "Already assigned"
        │
Interpreter B clicks Accept ──► Same transaction: fails (row locked or already assigned)
        │
        ▼
Call starts when both client and interpreter join room
```

## Real-Time Event Schema

| Event | Direction | Payload |
|-------|-----------|---------|
| `offer_created` | Server → Interpreter | `{ jobId, languagePair, specialty, duration, notes, expiresAt }` |
| `offer_accepted` | Interpreter → Server | `{ jobId, interpreterId }` |
| `offer_expired` | Server → Interpreter | `{ jobId }` |
| `job_assigned` | Server → Interpreter (winner) | `{ jobId, joinToken }` |
| `offer_revoked` | Server → Interpreter (others) | `{ jobId, reason: "filled" }` |
| `call_started` | Server → Both | `{ jobId, roomUrl }` |
| `call_ended` | Server → Both | `{ jobId, duration }` |
| `request_status` | Server → Client | `{ jobId, status, interpreterName? }` |

## Security

- **Auth**: NextAuth.js with credentials + JWT
- **RBAC**: Role-based middleware on all API routes
- **Encryption**: bcrypt for passwords, AES for sensitive fields (optional)
- **Audit**: All mutations logged to `audit_logs` table
- **File uploads**: Signed URLs, virus scan (Phase 2)
