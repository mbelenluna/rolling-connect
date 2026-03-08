import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Request a password reset. Sends email with reset link if user exists.
 * Always returns success to prevent email enumeration.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: true, message: 'If an account exists, you will receive a password reset link.' });
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      });

      await sendPasswordResetEmail(user.email, user.name, token);
    }

    return NextResponse.json({ ok: true, message: 'If an account exists, you will receive a password reset link.' });
  } catch (e) {
    console.error('Forgot password error:', e);
    return NextResponse.json({ ok: true, message: 'If an account exists, you will receive a password reset link.' });
  }
}
