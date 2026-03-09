import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ALLOWED_EMAILS = (process.env.ADMIN_DIAG_EMAILS || 'info@rolling-translations.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Admin-only: billing diagnostic. Query by email or mandateId. */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = (session?.user as { email?: string })?.email?.toLowerCase();
    const role = (session?.user as { role?: string })?.role;

    const isAdmin = role === 'admin' || (email && ALLOWED_EMAILS.includes(email));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const emailParam = searchParams.get('email');
    const mandateIdParam = searchParams.get('mandateId');

    if (!emailParam && !mandateIdParam) {
      return NextResponse.json(
        { error: 'Provide email=... or mandateId=...' },
        { status: 400 }
      );
    }

    const where =
      mandateIdParam
        ? { goCardlessMandateId: mandateIdParam }
        : { email: emailParam!.toLowerCase() };

    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionStatus: true,
        goCardlessMandateId: true,
        goCardlessCustomerId: true,
        billingDisabledAt: true,
        billingDisabledReason: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        found: false,
        message: 'No user found for the given email or mandate ID',
      });
    }

    const blocked =
      user.subscriptionStatus === 'REQUIRES_REAUTHORIZATION' ||
      user.subscriptionStatus === 'CANCELED';

    // Find mandate-related webhook events (payload may contain mandate ID)
    const allRecent = await prisma.goCardlessWebhookEvent.findMany({
      where: { resourceType: 'mandates' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        eventId: true,
        resourceType: true,
        action: true,
        processedAt: true,
        createdAt: true,
        payloadJson: true,
      },
    });

    const mandateId = user.goCardlessMandateId;
    const relatedEvents = mandateId
      ? allRecent.filter((e) => {
          const payload = e.payloadJson as { links?: { mandate?: string }; id?: string } | null;
          return (
            payload?.links?.mandate === mandateId || payload?.id === mandateId
          );
        })
      : [];

    return NextResponse.json({
      found: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        goCardlessMandateId: user.goCardlessMandateId,
        goCardlessCustomerId: user.goCardlessCustomerId ? '(set)' : null,
        billingDisabledAt: user.billingDisabledAt?.toISOString() ?? null,
        billingDisabledReason: user.billingDisabledReason,
      },
      accessBlocked: blocked,
      relatedWebhookEvents: relatedEvents.map((e) => ({
        eventId: e.eventId,
        resourceType: e.resourceType,
        action: e.action,
        processedAt: e.processedAt?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error('[diag/billing] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Diagnostic failed' },
      { status: 500 }
    );
  }
}
