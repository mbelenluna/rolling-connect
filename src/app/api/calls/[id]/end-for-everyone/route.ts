/**
 * POST /api/calls/[id]/end-for-everyone
 * Interpreter ends the call for everyone. Disconnects client and finalizes billing.
 */
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { finalizeBillableDuration } from '@/lib/call-billing';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: callId } = await params;
  const userId = (session.user as { id?: string }).id;

  const call = await prisma.call.findFirst({
    where: { id: callId },
    include: { job: { include: { request: true } } },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (call.job.assignedInterpreterId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (call.endedAt != null) return NextResponse.json({ success: true }); // Idempotent

  const endAt = new Date();
  const billableSeconds = await finalizeBillableDuration(callId, endAt);

  if (call.roomId.startsWith('rolling-')) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (accountSid && authToken) {
      try {
        const client = twilio(accountSid, authToken);
        const conferences = await client.conferences.list({
          friendlyName: call.roomId,
          status: 'in-progress',
        });
        for (const conf of conferences) {
          await client.conferences(conf.sid).update({ status: 'completed' });
        }
      } catch (e) {
        console.error('[end-for-everyone] Twilio conference end:', e);
      }
    }
  } else {
    const { deleteDailyRoom } = await import('@/lib/daily');
    const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    await deleteDailyRoom(roomName);
  }

  await prisma.$transaction([
    prisma.call.update({
      where: { id: callId },
      data: {
        endedAt: endAt,
        durationSeconds: Math.floor((endAt.getTime() - (call.startedAt ?? call.createdAt).getTime()) / 1000),
        billableDurationSeconds: billableSeconds,
        endedReason: 'interpreter_ended_for_all',
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

  return NextResponse.json({ success: true });
}
