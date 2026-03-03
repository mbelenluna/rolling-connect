# Rolling Connect — On-Demand Interpretation Platform

Production-ready OPI + VRI interpretation platform with Client, Interpreter, and Admin portals.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and NEXTAUTH_SECRET

# Initialize database
npx prisma db push
npx prisma db seed

# Run development server (custom server with Socket.io)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rolling-connect.com | password123 |
| Client | client@example.com | password123 |
| Interpreter 1 | interpreter1@example.com | password123 |
| Interpreter 2 | interpreter2@example.com | password123 |

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma
- **Auth**: NextAuth.js (credentials + JWT)
- **Real-time**: Socket.io (custom server)
- **Calls**: WebRTC placeholder (LiveKit/Daily.co for production)

## Documentation

- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Spec](docs/API_SPEC.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Matching Algorithm](docs/MATCHING_ALGORITHM.md)
- [Concurrency Strategy](docs/CONCURRENCY_STRATEGY.md)
- [MVP Plan](docs/MVP_IMPLEMENTATION_PLAN.md)

## Key Flows

1. **Client**: Request Interpreter Now → form → matching → first-accept wins → Join Call
2. **Interpreter**: Set Online → receive offer → Accept/Decline → Join Call
3. **Admin**: Manage users, jobs, rates, reporting

## Scripts

- `npm run dev` — Custom server with Socket.io
- `npm run build` — Production build
- `npm run start` — Production (use custom server for Socket.io)
- `npm run db:studio` — Prisma Studio
