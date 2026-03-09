/**
 * Twilio Conference statusCallback webhook.
 * - participant-join interpreter: start billable interval
 * - participant-leave interpreter: end billable interval (call stays active)
 * - participant-leave caller: finalize call (client_left), compute billable duration
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { startBillableInterval, endBillableInterval, finalizeBillableDuration } from '@/lib/call-billing';

export const dynamic = 'force-dynamic';

function getJobIdFromConference(friendlyName: string): string | null {
  const match = friendlyName.replace(/^rolling-/, '');
  return match || null;
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  if (!authToken || !accountSid) {
    return new NextResponse('', { status: 500 });
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const fullUrl = `${baseUrl.replace(/\/$/, '')}/api/twilio/voice/conference-status`;

  if (signature && !twilio.validateRequest(authToken, signature, fullUrl, params)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const event = params.StatusCallbackEvent;
  const participantLabel = params.ParticipantLabel || '';
  const friendlyName = params.FriendlyName || '';
  const jobId = getJobIdFromConference(friendlyName);

  console.log('[twilio/conference-status] EVENT', { event, participantLabel, friendlyName, jobId });

  if (!jobId) return new NextResponse('', { status: 200 });

  try {
    const { prisma } = await import('@/lib/prisma');
    const call = await prisma.call.findFirst({
      where: { jobId },
      include: { job: { include: { request: true } } },
    });

    if (!call) return new NextResponse('', { status: 200 });

    if (event === 'join') {
      if (participantLabel === 'interpreter') {
        await startBillableInterval(call.id);
        if (!call.startedAt) {
          await prisma.call.update({
            where: { id: call.id },
            data: { startedAt: new Date() },
          });
        }
      }
      return new NextResponse('', { status: 200 });
    }

    if (event === 'leave') {
      if (participantLabel === 'interpreter') {
        await endBillableInterval(call.id);
        return new NextResponse('', { status: 200 });
      }

      if (participantLabel === 'caller') {
        if (call.endedAt != null) return new NextResponse('', { status: 200 });

        const endAt = new Date();
        const billableSeconds = await finalizeBillableDuration(call.id, endAt);

        await prisma.$transaction([
          prisma.call.update({
            where: { id: call.id },
            data: {
              endedAt: endAt,
              durationSeconds: Math.floor((endAt.getTime() - (call.startedAt ?? call.createdAt).getTime()) / 1000),
              billableDurationSeconds: billableSeconds,
              endedReason: 'client_left',
            },
          }),
          prisma.job.update({ where: { id: call.jobId }, data: { status: 'completed' } }),
          prisma.interpretationRequest.update({
            where: { id: call.job.requestId },
            data: { status: 'completed' },
          }),
        ]);

        const io = (global as { io?: { to: (r: string) => { emit: (e: string, p: unknown) => void } } }).io;
        io?.to(`user:${call.job.request.createdByUserId}`).emit('call_ended', { jobId: call.jobId, durationSeconds: billableSeconds });
        if (call.job.assignedInterpreterId) {
          io?.to(`user:${call.job.assignedInterpreterId}`).emit('call_ended', { jobId: call.jobId, durationSeconds: billableSeconds });
        }
      }
    }
  } catch (e) {
    console.error('[twilio/conference-status]', e);
  }

  return new NextResponse('', { status: 200 });
}
