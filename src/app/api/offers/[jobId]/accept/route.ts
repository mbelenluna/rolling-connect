import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LOG_PREFIX = '[accept]';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  const interpreterId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user) {
    console.warn(LOG_PREFIX, 'Unauthorized: no session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'interpreter') {
    console.warn(LOG_PREFIX, 'Forbidden: role=', role);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { jobId } = await params;
  console.log(LOG_PREFIX, 'Accept attempt', { jobId, interpreterId });

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

    // Phone-originated requests create Call in phone-request; web requests create it here
    let call = await tx.call.findUnique({ where: { jobId } });
    if (!call) {
      const { generateUniquePhoneSessionCode } = await import('@/lib/session-code');
      const phoneSessionCode = await generateUniquePhoneSessionCode();
      call = await tx.call.create({
        data: {
          jobId,
          roomId: `room_${jobId}_${Date.now()}`,
          phoneSessionCode,
        },
      });
    }

    return { success: true, job: { ...job, status: 'assigned' as const, call } };
  });

  if (!result.success) {
    console.warn(LOG_PREFIX, 'Accept failed', { jobId, interpreterId, error: (result as { error?: string }).error });
    return NextResponse.json({ success: false, error: (result as { error?: string }).error }, { status: 400 });
  }

  const jobResult = result as { job: { requestId: string; call?: { roomId: string } } };
  console.log(LOG_PREFIX, 'Accept success', { jobId, requestId: jobResult.job.requestId, interpreterId });
  const requestId = jobResult.job.requestId;
  const roomId = jobResult.job.call?.roomId ?? `room_${jobId}`;

  // Publish via Ably (Vercel-compatible)
  const { publishRequestStatus } = await import('@/lib/realtime/server');
  publishRequestStatus(requestId, {
    status: 'assigned',
    timestamp: Date.now(),
    requestId,
  }).catch((e) => console.error(LOG_PREFIX, 'publishRequestStatus:', e));

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
