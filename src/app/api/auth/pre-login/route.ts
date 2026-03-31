import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMfaCode } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ ok: false, error: 'Missing credentials' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: false, error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return NextResponse.json({ ok: false, error: 'Invalid credentials' });

    if (!user.mfaEnabled) {
      return NextResponse.json({ ok: true, requiresMfa: false });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Clean up old unused codes and create new one
    await prisma.mfaCode.deleteMany({ where: { userId: user.id } });
    await prisma.mfaCode.create({ data: { userId: user.id, code, expiresAt } });

    await sendMfaCode(user.email, user.name, code);

    return NextResponse.json({ ok: true, requiresMfa: true });
  } catch (e) {
    console.error('Pre-login error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
