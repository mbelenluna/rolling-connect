# Rolling Connect — MVP Implementation Plan

## Phase 1 (Ship First)

### Milestone 1.1: Foundation (Week 1)
- [x] Project setup: Next.js 14, Prisma, PostgreSQL
- [x] Database schema + migrations
- [x] Auth: NextAuth credentials, JWT, RBAC middleware
- [x] Seed: languages, specialties, test users

### Milestone 1.2: Core API (Week 2)
- [x] POST /requests — create request
- [x] Matching engine (find eligible interpreters)
- [x] Job creation + offer dispatch
- [x] POST /offers/:jobId/accept — atomic accept
- [x] WebSocket: offer_created, job_assigned, offer_revoked

### Milestone 1.3: Portals (Week 3)
- [x] Client: Request form (quick, ≤30s), status view
- [x] Interpreter: Profile, availability, offer cards, Accept/Decline
- [x] Real-time status updates in both portals

### Milestone 1.4: Call Experience (Week 4)
- [x] WebRTC integration (LiveKit or simple peer-to-peer)
- [x] OPI: audio room
- [x] VRI: video room
- [x] Join/leave, mute, camera toggle
- [x] Call end → duration recorded

### Milestone 1.5: Admin & Billing (Week 5)
- [x] Admin: user management, job queue, force cancel
- [x] Billing: duration tracking, line items, invoice generation
- [x] Email: offer notification, job filled

---

## Phase 2 (Post-MVP)

- Scheduled requests (cron/scheduler)
- Escalation: broaden criteria on timeout
- Interpreter pools / vendor management
- Full reporting dashboard
- Disputes workflow
- Payment processing (Stripe)
- Glossary upload, attachment handling
- Equipment test flow
- Mobile-responsive polish

---

## Tech Stack

| Component | Choice |
|-----------|--------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js |
| Real-time | Socket.io |
| Calls | LiveKit (or Daily.co) |
| Email | Resend |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
