/**
 * Twilio Conference statusCallback webhook.
 * When caller (participantLabel=caller) leaves, disconnect the interpreter and end the call.
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

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
  const conferenceSid = params.ConferenceSid;
  const callSid = params.CallSid;
  const participantLabel = params.ParticipantLabel || '';

  if (event !== 'participant-leave') {
    return new NextResponse('', { status: 200 });
  }

  if (participantLabel !== 'caller') {
    return new NextResponse('', { status: 200 });
  }

  // Caller hung up — disconnect interpreter and end our call record
  try {
    const client = twilio(accountSid, authToken);
    const participants = await client.conferences(conferenceSid).participants.list();
    for (const p of participants) {
      if (p.label === 'interpreter') {
        await client.calls(p.callSid).update({ status: 'completed' });
        break;
      }
    }

    const friendlyName = params.FriendlyName || '';
    const jobIdMatch = friendlyName.replace(/^rolling-/, '');
    if (jobIdMatch) {
      const { prisma } = await import('@/lib/prisma');
      const call = await prisma.call.findFirst({
        where: { jobId: jobIdMatch },
        include: { job: { include: { request: true } } },
      });
      if (call && call.durationSeconds == null) {
        const io = (global as { io?: { to: (r: string) => { emit: (e: string, p: unknown) => void } } }).io;
        const durationSeconds = 0;
        await prisma.$transaction([
          prisma.call.update({
            where: { id: call.id },
            data: { endedAt: new Date(), durationSeconds },
          }),
          prisma.job.update({ where: { id: call.jobId }, data: { status: 'completed' } }),
          prisma.interpretationRequest.update({
            where: { id: call.job.requestId },
            data: { status: 'completed' },
          }),
        ]);
        io?.to(`user:${call.job.request.createdByUserId}`).emit('call_ended', { jobId: call.jobId, durationSeconds });
        if (call.job.assignedInterpreterId) {
          io?.to(`user:${call.job.assignedInterpreterId}`).emit('call_ended', { jobId: call.jobId, durationSeconds });
        }
      }
    }
  } catch (e) {
    console.error('[twilio/conference-status]', e);
  }

  return new NextResponse('', { status: 200 });
}
