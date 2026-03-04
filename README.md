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

## GoCardless Billing Flow (Prod Checklist)

Every client and interpreter must complete a GoCardless Redirect Flow (ACH mandate + subscription) before accessing protected pages.

### Setup

1. **Environment variables** (in `.env` and Vercel):
   - `GOCARDLESS_ACCESS_TOKEN` — API token from Developer → Access tokens
   - `GOCARDLESS_ENV` — `sandbox` or `live`
   - `GOCARDLESS_WEBHOOK_ENDPOINT_SECRET` — From Developer → Webhooks → Create endpoint
   - `NEXTAUTH_URL` — Must be `https://rolling-connect.com` (or your domain) in prod

2. **Database migration**:
   ```bash
   npx prisma db push
   # or: npx prisma migrate dev --name add_gocardless_billing
   ```

3. **Webhook in GoCardless Dashboard**:
   - URL: `https://your-domain.com/api/webhooks/gocardless`
   - Copy the webhook secret into `GOCARDLESS_WEBHOOK_ENDPOINT_SECRET`

### Flow

- **Start**: `POST /api/billing/start` (auth required) → returns `redirectUrl` → redirect user to GoCardless
- **Confirm**: User returns to `GET /api/billing/confirm?redirect_flow_id=RE...` → flow completed, IDs stored, user redirected to dashboard
- **Webhook**: `POST /api/webhooks/gocardless` — processes mandate/payment events, updates `subscriptionStatus`

### Gating

- Client and interpreter layouts use `requireBilling` — redirect to `/subscribe` if `subscriptionStatus !== 'ACTIVE'`
- Admin bypasses billing

## Reset Test Users

To delete specific test accounts (e.g. to re-register them):

```bash
# Preview what would be deleted (no changes)
npm run reset-test-users -- --dry-run

# Delete default list (info@rolling-translations.com, belen_luna:_1801@hotmail.com, mariabelenluna18@gmail.com)
npm run reset-test-users -- --confirm

# Delete specific emails
npm run reset-test-users -- --confirm user@example.com
```

**Requires `--confirm`** to actually delete. Without it, the script exits with usage instructions.

## Auth Diagnostics

When logged in as an allowed admin, `GET /api/admin/diag/auth` returns env/DB sanity checks (no secrets). Set `ADMIN_DIAG_EMAILS` in `.env` (comma-separated) to allow access.

## Regression Checklist (Auth)

- [ ] `npm run build` passes
- [ ] Register new user (client) → 200 JSON, redirect to /login?registered=client
- [ ] Register new user (interpreter) → 200 JSON, sign in, redirect to /dashboard
- [ ] Login existing user (credentials) → redirect to /dashboard
- [ ] Login with Google (if configured) → redirect to /dashboard
- [ ] NextAuth errors redirect to /login with error message (not generic Error page)
- [ ] Vercel: NEXTAUTH_URL=https://rolling-connect.com, NEXTAUTH_SECRET set
- [ ] Google OAuth: redirect URIs include https://rolling-connect.com/api/auth/callback/google-client and google-interpreter

## Scripts

- `npm run dev` — Custom server with Socket.io
- `npm run build` — Production build
- `npm run start` — Production (use custom server for Socket.io)
- `npm run db:studio` — Prisma Studio
