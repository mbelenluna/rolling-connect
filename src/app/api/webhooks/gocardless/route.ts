/**
 * GoCardless webhook handler.
 * Verifies signature, processes events idempotently, updates billing state.
 * IMPORTANT: Uses raw body for signature verification - do not parse before verify.
 */
import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/gocardless';

export const dynamic = 'force-dynamic';

type GoCardlessEvent = {
  id: string;
  resource_type?: string;
  action?: string;
  links?: { mandate?: string; payment?: string };
};

export async function POST(req: Request) {
  try {
    // MUST read raw body before any parsing - required for signature verification
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('Webhook-Signature');

    try {
      verifyWebhookSignature(rawBody, signatureHeader);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid signature';
      console.warn('[gocardless/webhook] Signature verification failed:', msg);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    let payload: { events?: GoCardlessEvent[] };
    try {
      payload = JSON.parse(rawBody) as { events?: GoCardlessEvent[] };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const events = payload.events ?? [];
    const { prisma } = await import('@/lib/prisma');

    for (const event of events) {
      try {
        // Idempotency: skip if already processed
        const existing = await prisma.goCardlessWebhookEvent.findUnique({
          where: { eventId: event.id },
        });
        if (existing) {
          if (existing.processedAt) continue;
          // Re-process if stored but not yet processed (e.g. previous run failed mid-way)
        }

        // Store event (upsert for retries)
        await prisma.goCardlessWebhookEvent.upsert({
          where: { eventId: event.id },
          create: {
            eventId: event.id,
            resourceType: event.resource_type ?? 'unknown',
            action: event.action ?? 'unknown',
            payloadJson: event as unknown as object,
          },
          update: {},
        });

        const resourceType = event.resource_type ?? '';
        const action = (event.action ?? '').toLowerCase();
        const mandateId = event.links?.mandate;

        // --- mandates.cancelled: billing state transition to requires_reauthorization ---
        if (resourceType === 'mandates' && (action === 'cancelled' || action === 'failed')) {
          if (mandateId) {
            const updated = await prisma.user.updateMany({
              where: { goCardlessMandateId: mandateId },
              data: {
                subscriptionStatus: 'REQUIRES_REAUTHORIZATION',
                billingDisabledAt: new Date(),
                billingDisabledReason: 'GoCardless mandate cancelled',
                // Keep goCardlessMandateId for reference; new mandate will replace on reauth
              },
            });
            console.log('[gocardless/webhook] Mandate cancelled', { mandateId, usersUpdated: updated.count });
          }
        }

        // --- mandates.created / mandates.active: no state change (mandate already linked on redirect complete) ---
        if (resourceType === 'mandates' && (action === 'created' || action === 'active')) {
          // Optional: log for audit
        }

        // --- payments.failed: set past_due ---
        if (resourceType === 'payments' && (action === 'failed' || action === 'cancelled')) {
          if (mandateId) {
            await prisma.user.updateMany({
              where: { goCardlessMandateId: mandateId },
              data: { subscriptionStatus: 'PAST_DUE' },
            });
          }
        }

        // --- payments.confirmed: ensure active (idempotent) ---
        if (resourceType === 'payments' && action === 'confirmed') {
          if (mandateId) {
            await prisma.user.updateMany({
              where: {
                goCardlessMandateId: mandateId,
                subscriptionStatus: { in: ['PAST_DUE', 'REQUIRES_REAUTHORIZATION'] },
              },
              data: { subscriptionStatus: 'ACTIVE', billingDisabledAt: null, billingDisabledReason: null },
            });
          }
        }

        // Mark as processed
        await prisma.goCardlessWebhookEvent.update({
          where: { eventId: event.id },
          data: { processedAt: new Date() },
        });
      } catch (e) {
        console.error('[gocardless/webhook] Event processing error:', { eventId: event.id, error: e });
        // Do not mark processed - allow retry on next delivery
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[gocardless/webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
