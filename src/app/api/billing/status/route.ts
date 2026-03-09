import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Returns billing status for the current user. Used by frontend to show reauthorize banner. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        billingDisabledAt: true,
        billingDisabledReason: true,
        goCardlessMandateId: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const requiresReauth =
      user.subscriptionStatus === 'REQUIRES_REAUTHORIZATION' || user.subscriptionStatus === 'CANCELED';

    return NextResponse.json({
      subscriptionStatus: user.subscriptionStatus,
      billingDisabledAt: user.billingDisabledAt?.toISOString() ?? null,
      billingDisabledReason: user.billingDisabledReason,
      requiresReauthorization: requiresReauth,
      hasMandate: !!user.goCardlessMandateId,
    });
  } catch (e) {
    console.error('[billing/status] Error:', e);
    return NextResponse.json({ error: 'Failed to get billing status' }, { status: 500 });
  }
}
