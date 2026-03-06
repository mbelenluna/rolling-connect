import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getBaseUrl(req: NextRequest): string {
  let baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);
  if (baseUrl.startsWith('http://') && !baseUrl.includes('localhost')) {
    baseUrl = baseUrl.replace(/^http:\/\//, 'https://');
  }
  return baseUrl;
}

/** GET: Redirect to confirm page (for old email links). Does NOT consume the token. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
  }
  const baseUrl = getBaseUrl(req);
  return NextResponse.redirect(new URL(`/verify-email/confirm?token=${encodeURIComponent(token)}`, baseUrl));
}

/** POST: Actually confirm the email. Consumes the token. */
export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const token = body?.token;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const record = await prisma.emailConfirmationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This verification link has expired or has already been used. Please request a new one.' },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailConfirmedAt: new Date() },
    }),
    prisma.emailConfirmationToken.delete({ where: { id: record.id } }),
  ]);

  const baseUrl = getBaseUrl(req);
  const redirectUrl = `${baseUrl}/login?confirmed=1&email=${encodeURIComponent(record.user.email)}&callbackUrl=${encodeURIComponent('/subscribe')}`;
  return NextResponse.json({ ok: true, redirectUrl });
}
