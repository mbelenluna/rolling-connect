# Neon Database Setup Checklist

Use this checklist to create Prisma tables in your Neon database and fix the "User table does not exist" error.

## 1) Migration vs db push

- **`prisma/migrations/` exists** but contains only one migration (`20250226000000_add_email_confirmation_and_registration_path`) that **ALTERs** an existing `users` table.
- There is **no initial migration** that creates the base schema, so `prisma migrate deploy` would fail on a fresh DB.
- **Use `prisma db push`** to create all tables from the current schema.

## 2) Create schema in Neon

### Step 1: Get your Neon connection string

In [Neon Console](https://console.neon.tech) → your project → Connection Details, copy the connection string. It should look like:

```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

For pooled connections (recommended for serverless):

```
postgresql://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 2: Run Prisma against Neon (PowerShell)

```powershell
# Set DATABASE_URL to your Neon connection string (same as Vercel Production)
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"

# Generate Prisma client (if needed)
npx prisma generate

# Push schema to Neon - creates all tables
npx prisma db push
```

**Expected output:**
```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "neondb" at "xxx.neon.tech"

🚀  Your database is now in sync with your Prisma schema.
```

### Step 3 (optional): Seed test data

```powershell
npx prisma db seed
```

## 3) Verify tables exist

In **Neon SQL Editor**, run:

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
```

**Expected tables** (among others):

- `User` (or `users` depending on Prisma version)
- `Organization`
- `organization_members`
- `InterpretationRequest`
- `Job`
- `Call`
- `email_confirmation_tokens`
- `gocardless_webhook_events`
- `gocardless_redirect_sessions`
- etc.

**Note:** This app uses **NextAuth with JWT** (no database adapter). There are no `Account`, `Session`, or `VerificationToken` tables. The `User` table is your custom Prisma model.

## 4) NextAuth tables

- **No NextAuth adapter** – the app uses `session: { strategy: 'jwt' }`, so NextAuth does not use the database for sessions.
- The `User` table is your Prisma model used by `prisma.user.findUnique()` in the credentials provider and Google sign-in callbacks.
- Prisma model `User` maps to table `User` (default; no `@@map` on the model).

## 5) Vercel verification

In **Vercel** → Project → Settings → Environment Variables:

| Variable        | Value                                      | Environment |
|----------------|---------------------------------------------|-------------|
| DATABASE_URL   | Your Neon connection string (pooled + sslmode=require) | Production  |
| NEXTAUTH_URL   | `https://www.rolling-connect.com`           | Production  |
| NEXTAUTH_SECRET| (your secret)                               | Production  |

**NEXTAUTH_URL:** Use the exact URL users see. If the app is at `https://www.rolling-connect.com`, set that. If it redirects to `https://rolling-connect.com`, use that instead. Be consistent with your domain config.

**Redeploy:** After changing env vars or running migrations, trigger a redeploy (Deployments → ⋯ → Redeploy).

## 6) Retest checklist

- [ ] Login with existing credentials → no `/api/auth/error`
- [ ] Register new user → success, redirect to login
- [ ] Google login (if configured) → redirect works
- [ ] No "User table does not exist" error

## Troubleshooting

### "prisma db push" fails with connection error

- Check `DATABASE_URL` format and that it includes `?sslmode=require`.
- Ensure the Neon project is not paused.
- For Vercel, prefer the **pooled** connection string (host contains `-pooler`).

### Tables still missing after db push

- Run `npx prisma db push --accept-data-loss` if you need to reset (this will drop and recreate; only use on empty DB).
- Confirm you are using the same `DATABASE_URL` as Vercel Production.

### "User table does not exist" persists after push

- Confirm `DATABASE_URL` in Vercel Production matches the Neon DB you pushed to.
- Redeploy the Vercel project after env changes.
- Check Neon SQL Editor: `SELECT * FROM "User" LIMIT 1;` (or `"users"` if your schema uses that).
