import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/gocardless';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('Webhook-Signature');

    try {
      verifyWebhookSignature(rawBody, signatureHeader);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as { events?: Array<{ id: string; resource_type: string; action: string }> };
    const events = payload.events ?? [];

    const { prisma } = await import('@/lib/prisma');

    for (const event of events) {
      try {
        const existing = await prisma.goCardlessWebhookEvent.findUnique({
          where: { eventId: event.id },
        });
        if (existing) continue;

        await prisma.goCardlessWebhookEvent.create({
          data: {
            eventId: event.id,
            resourceType: event.resource_type ?? 'unknown',
            action: event.action ?? 'unknown',
            payloadJson: event as unknown as object,
          },
        });

        if (event.resource_type === 'mandates') {
          const action = event.action ?? '';
          if (action === 'cancelled' || action === 'failed') {
            const mandateId = (event as { links?: { mandate?: string } }).links?.mandate;
            if (mandateId) {
              await prisma.user.updateMany({
                where: { goCardlessMandateId: mandateId },
                data: { subscriptionStatus: 'CANCELED' },
              });
            }
          }
        }

        if (event.resource_type === 'payments') {
          const action = event.action ?? '';
          if (action === 'failed' || action === 'cancelled') {
            const payment = event as { links?: { mandate?: string } };
            const mandateId = payment.links?.mandate;
            if (mandateId) {
              await prisma.user.updateMany({
                where: { goCardlessMandateId: mandateId },
                data: { subscriptionStatus: 'PAST_DUE' },
              });
            }
          }
        }
      } catch (e) {
        console.error('Webhook event processing error:', e);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
