import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmailConfirmation, sendInterpreterWelcomeEmail } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['client', 'interpreter']),
  organization: z.string().optional(),
});

export const dynamic = 'force-dynamic';

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      const text = await req.text();
      if (!text?.trim()) {
        if (process.env.NODE_ENV !== 'production') console.warn('[register] Empty request body');
        return jsonError('Invalid request body', 400);
      }
      body = JSON.parse(text);
    } catch {
      if (process.env.NODE_ENV !== 'production') console.warn('[register] Invalid JSON body');
      return jsonError('Invalid JSON body', 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { email, password, name, role, organization } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ ok: false, error: 'Email already registered' }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true },
    });

    if (role === 'client') {
      const orgName = organization?.trim() || `${name}'s Organization`;
      const org = await prisma.organization.create({
        data: { name: orgName, billingEmail: email },
      });
      await prisma.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'owner' },
      });
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.emailConfirmationToken.create({
        data: { userId: user.id, token, expiresAt },
      });
      sendEmailConfirmation(email, name, token).catch((e) => console.error('Confirmation email failed:', e));
    }

    if (role === 'interpreter') {
      await prisma.interpreterProfile.create({
        data: {
          userId: user.id,
          languagePairs: [],
          specialties: [],
        },
      });
      await prisma.interpreterAvailability.create({
        data: { userId: user.id, status: 'offline' },
      });
      sendInterpreterWelcomeEmail(email, name).catch((e) => console.error('Interpreter welcome email failed:', e));
    }

    if (process.env.NODE_ENV !== 'production') console.log('[register] Created user', user.id, user.email);
    return NextResponse.json({ ok: true, id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    console.error('[register] Error:', e instanceof Error ? e.message : e);
    const msg = e instanceof Error ? e.message : 'Registration failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
