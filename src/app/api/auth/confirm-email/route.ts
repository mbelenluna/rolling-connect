import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', req.url));
  }

  const record = await prisma.emailConfirmationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.redirect(new URL('/login?error=expired_token', req.url));
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailConfirmedAt: new Date() },
    }),
    prisma.emailConfirmationToken.delete({ where: { id: record.id } }),
  ]);

  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : req.nextUrl.origin);
  return NextResponse.redirect(new URL(`/login?confirmed=1&email=${encodeURIComponent(record.user.email)}&callbackUrl=${encodeURIComponent('/subscribe')}`, baseUrl));
}
