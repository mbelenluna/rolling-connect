import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmailConfirmation } from '@/lib/email';

/**
 * POST /api/auth/resend-verification
 * Body: { email?: string } — if omitted, uses session user's email
 * GET /api/auth/resend-verification?email=... — same, email from query or session
 */
export const dynamic = 'force-dynamic';

async function resend(emailFromRequest: string | undefined) {
  let email = emailFromRequest?.trim();
  if (!email || !email.includes('@')) {
    const session = await getServerSession(authOptions);
    const sessionEmail = (session?.user as { email?: string })?.email;
    if (sessionEmail?.includes('@')) email = sessionEmail;
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role !== 'client') {
    return NextResponse.json({ error: 'Email verification is only for client accounts' }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailConfirmationToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, token, expiresAt },
    update: { token, expiresAt },
  });

  const result = await sendEmailConfirmation(user.email, user.name, token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Verification email sent to ${email}` });
}

export async function POST(req: NextRequest) {
  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body ok — will fall back to session
  }
  return resend(body.email);
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || undefined;
  return resend(email);
}
