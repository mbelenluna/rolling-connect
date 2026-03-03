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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, role, organization } = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 400 });

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

    return NextResponse.json(user);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors }, { status: 400 });
    throw e;
  }
}
