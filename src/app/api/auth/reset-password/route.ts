import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const dynamic = 'force-dynamic';

function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
  if ((pwd.match(/\d/g) || []).length < 2) return 'Password must contain at least two digits';
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(pwd)) return 'Password must contain at least one special character';
  return null;
}

/**
 * POST /api/auth/reset-password
 * Reset password using token from email link.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ') || 'Invalid request';
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
    const { token, password } = parsed.data;

    const pwdError = validatePassword(password);
    if (pwdError) {
      return NextResponse.json({ ok: false, error: pwdError }, { status: 400 });
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
    ]);

    return NextResponse.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (e) {
    console.error('Reset password error:', e);
    return NextResponse.json({ ok: false, error: 'Failed to reset password' }, { status: 500 });
  }
}
