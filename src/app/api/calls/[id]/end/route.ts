import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  durationSeconds: z.number(),
  interpreterNotes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');
    const { deleteDailyRoom } = await import('@/lib/daily');

    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const { durationSeconds, interpreterNotes } = parsed.data;

    const call = await prisma.call.findFirst({
      where: { id },
      include: { job: { include: { request: true } } },
    });

    if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userId = (session.user as { id?: string }).id;
    const role = (session.user as { role?: string }).role;
    const isInterpreter = call.job.assignedInterpreterId === userId;
    const isClient = call.job.request.createdByUserId === userId;
    if (!isInterpreter && !isClient && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (call.durationSeconds != null) return NextResponse.json({ success: true }); // Already ended (idempotent)

    await prisma.$transaction([
      prisma.call.update({
        where: { id },
        data: { endedAt: new Date(), durationSeconds, interpreterNotes },
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

    // Delete the Daily room to disconnect ALL participants (client, interpreter, guests).
    // This prevents invitees from staying in the meeting after the host ends the call.
    const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    await deleteDailyRoom(roomName);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('End call error:', e);
    const msg = e instanceof Error ? e.message : 'Failed to end call';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
