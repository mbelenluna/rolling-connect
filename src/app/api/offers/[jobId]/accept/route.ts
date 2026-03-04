import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interpreterId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;
  if (role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId } = await params;

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.findFirst({
      where: { id: jobId },
      include: { request: true },
    });
    if (!job) return { success: false, error: 'NOT_FOUND' };
    if (job.status !== 'offered') return { success: false, error: 'ALREADY_ASSIGNED' };
    if (job.offerExpiresAt && job.offerExpiresAt < new Date()) return { success: false, error: 'EXPIRED' };

    const offeredTo = (job.offeredToIds as string[]) || [];
    if (!offeredTo.includes(interpreterId!)) return { success: false, error: 'NOT_OFFERED' };

    const updated = await tx.job.updateMany({
      where: { id: jobId, status: 'offered' },
      data: { status: 'assigned', assignedInterpreterId: interpreterId },
    });

    if (updated.count === 0) return { success: false, error: 'ALREADY_ASSIGNED' };

    await tx.interpretationRequest.update({
      where: { id: job.requestId },
      data: { status: 'assigned' },
    });

    const call = await tx.call.create({
      data: {
        jobId,
        roomId: `room_${jobId}_${Date.now()}`,
      },
    });

    return { success: true, job: { ...job, status: 'assigned' as const, call } };
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  const io = (global as { io?: { to: (room: string) => { emit: (e: string, p: unknown) => void } } }).io;
  const jobResult = result as { job: { offeredToIds: unknown; requestId: string; request?: { createdByUserId: string }; call?: { roomId: string } } };
  const offeredTo = (jobResult.job.offeredToIds as string[]) || [];
  const roomId = jobResult.job.call?.roomId ?? `room_${jobId}`;
  const payload = { jobId, requestId: jobResult.job.requestId };

  offeredTo.forEach((uid) => {
    if (uid === interpreterId) {
      io?.to(`user:${uid}`).emit('job_assigned', { ...payload, joinToken: `token_${roomId}_${uid}`, roomId });
    } else {
      io?.to(`user:${uid}`).emit('offer_revoked', { ...payload, reason: 'filled' });
    }
  });

  const clientUserId = jobResult.job.request?.createdByUserId;
  if (clientUserId) {
    io?.to(`user:${clientUserId}`).emit('request_status', {
      jobId,
      requestId: jobResult.job.requestId,
      status: 'assigned',
      interpreterId,
      roomId,
    });
  }

  return NextResponse.json({
    success: true,
    job: {
      id: jobId,
      status: 'assigned',
      joinToken: `token_${roomId}_${interpreterId}`,
      roomId,
    },
  });
}
