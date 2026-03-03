import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ejectDailyParticipants } from '@/lib/daily';
import { verifyInviteToken } from '@/lib/invite-token';
import { z } from 'zod';

const schema = z.object({
  inviteToken: z.string(),
  durationSeconds: z.number(),
});

/**
 * POST /api/calls/[id]/guest-leave
 * Ends the call when a guest (invite link) leaves. Auth via inviteToken.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ') || 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { inviteToken, durationSeconds } = parsed.data;

    const verifiedCallId = verifyInviteToken(inviteToken);
    if (!verifiedCallId || verifiedCallId !== id) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 401 });
    }

    const call = await prisma.call.findFirst({
      where: { id },
      include: { job: { include: { request: true } } },
    });

    if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (call.durationSeconds != null) return NextResponse.json({ success: true }); // Already ended (idempotent)

    await prisma.$transaction([
      prisma.call.update({
        where: { id },
        data: { endedAt: new Date(), durationSeconds },
      }),
      prisma.job.update({
        where: { id: call.jobId },
        data: { status: 'completed' },
      }),
      prisma.interpretationRequest.update({
        where: { id: call.job.requestId },
        data: { status: 'completed' },
      }),
    ]);

    const io = (global as { io?: { to: (room: string) => { emit: (e: string, p: unknown) => void } } }).io;
    io?.to(`user:${call.job.request.createdByUserId}`).emit('call_ended', { jobId: call.jobId, durationSeconds });
    if (call.job.assignedInterpreterId) {
      io?.to(`user:${call.job.assignedInterpreterId}`).emit('call_ended', { jobId: call.jobId, durationSeconds });
    }

    const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    const userIds = [call.job.request.createdByUserId];
    if (call.job.assignedInterpreterId) userIds.push(call.job.assignedInterpreterId);
    await ejectDailyParticipants(roomName, userIds);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Guest leave error:', e);
    const msg = e instanceof Error ? e.message : 'Failed to end call';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
