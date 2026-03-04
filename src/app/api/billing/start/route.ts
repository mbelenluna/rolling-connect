import { NextResponse } from 'next/server';
import { createRedirectFlow, generateSessionToken } from '@/lib/gocardless';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const email = (session.user as { email?: string }).email ?? '';
    const name = (session.user as { name?: string }).name ?? '';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXTAUTH_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'NEXTAUTH_URL not configured' },
        { status: 500 }
      );
    }

    const sessionToken = generateSessionToken();

    const redirectSession = await prisma.goCardlessRedirectSession.create({
      data: {
        userId,
        sessionToken,
      },
    });

    const { redirectFlowId, redirectUrl } = await createRedirectFlow({
      user: { email, name },
      successUrl: `${baseUrl}/api/billing/confirm`,
      sessionToken,
    });

    await prisma.goCardlessRedirectSession.update({
      where: { id: redirectSession.id },
      data: { redirectFlowId },
    });

    return NextResponse.json({ redirectUrl });
  } catch (err) {
    console.error('Billing start error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to start billing setup';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
