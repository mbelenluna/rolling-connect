import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'site_access';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getCookieValue(password: string): string {
  return crypto.createHmac('sha256', password).update('site_access_verified').digest('hex');
}

export async function POST(req: Request) {
  const password = process.env.SITE_ACCESS_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => ({}));
  const submitted = body.password ?? '';

  if (submitted !== password) {
    return NextResponse.json({ error: 'Invalid access code' }, { status: 401 });
  }

  const value = getCookieValue(password);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
