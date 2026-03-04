import { NextResponse } from 'next/server';

/**
 * Returns whether Google OAuth is configured (for showing/hiding the Sign in with Google button).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled =
    !!process.env.GOOGLE_CLIENT_ID &&
    !!process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID.trim().length > 0 &&
    process.env.GOOGLE_CLIENT_SECRET.trim().length > 0;
  return NextResponse.json({ enabled });
}
