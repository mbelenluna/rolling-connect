/**
 * POST /api/calls/[id]/mark-started
 * Records call.startedAt the moment both participants are in the Daily.co room.
 * Called from CallRoom.tsx when the timer starts (count >= 2 participants).
 * Idempotent: if startedAt is already set, this is a no-op.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');

    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const call = await prisma.call.findFirst({
      where: { id },
      include: { job: { include: { request: true } } },
    });

    if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userId = (session.user as { id?: string }).id;
    const role = (session.user as { role?: string }).role;
    const isInterpreter = call.job.assignedInterpreterId === userId;
    const isClient = call.job.request.createdByUserId === userId;
    if (!isInterpreter && !isClient && role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Idempotent — only set startedAt once
    if (call.startedAt) return NextResponse.json({ success: true });

    await prisma.call.update({
      where: { id },
      data: { startedAt: new Date() },
    });

    const { logAudit } = await import('@/lib/audit');
    logAudit({ userId, action: 'call_started', entityType: 'call', entityId: id, metadata: { jobId: call.jobId, requestId: call.job.requestId, serviceType: call.job.request.serviceType } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[mark-started] error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
