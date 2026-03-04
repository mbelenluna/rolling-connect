import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_EMAILS = (process.env.ADMIN_DIAG_EMAILS || 'info@rolling-translations.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function GET() {
  try {
    const { getServerSession } = await import('next-auth');
    const { prisma } = await import('@/lib/prisma');
    const session = await getServerSession(authOptions);
    const email = (session?.user as { email?: string })?.email?.toLowerCase();
    if (!email || !ALLOWED_EMAILS.includes(email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
    const hasNextAuthUrl = !!process.env.NEXTAUTH_URL;
    const nextAuthUrl = process.env.NEXTAUTH_URL || '(not set)';
    const hasGoogleClient = !!process.env.GOOGLE_CLIENT_ID;
    const hasGoogleSecret = !!process.env.GOOGLE_CLIENT_SECRET;

    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e) {
      console.error('[diag/auth] DB check failed:', e);
    }

    return NextResponse.json({
      env: {
        hasDatabaseUrl,
        hasNextAuthSecret,
        hasNextAuthUrl,
        nextAuthUrl,
        hasGoogleClient,
        hasGoogleSecret,
      },
      db: { ok: dbOk },
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (e) {
    console.error('[diag/auth] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Diagnostic failed' },
      { status: 500 }
    );
  }
}
