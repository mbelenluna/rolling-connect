import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  // Client-reported duration kept for auditing; server always recomputes from startedAt.
  durationSeconds: z.number().optional(),
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
      body = {};
    }
    const parsed = schema.safeParse(body);
    const interpreterNotes = parsed.success ? parsed.data.interpreterNotes : undefined;

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

    // Client-owned model: only client can end via this endpoint. Interpreter must use /end-for-everyone.
    const isDailyCall = !call.roomId.startsWith('rolling-');
    if (isDailyCall && isInterpreter && !isClient) {
      return NextResponse.json({ error: 'Use "End Call for Everyone" to end the call' }, { status: 403 });
    }

    if (call.durationSeconds != null) return NextResponse.json({ success: true }); // Already ended (idempotent)

    const endAt = new Date();

    // Always compute duration server-side from startedAt (set by mark-started when both
    // participants joined). Falls back to createdAt so we never store 0.
    const serverDuration = Math.max(
      0,
      Math.floor((endAt.getTime() - (call.startedAt ?? call.createdAt).getTime()) / 1000)
    );

    // Prefer the client-reported value if it's larger and plausible (guards against
    // clock skew where startedAt was set slightly after the actual join).
    const clientDuration = parsed.success ? (parsed.data.durationSeconds ?? 0) : 0;
    const durationSeconds = Math.max(serverDuration, clientDuration);

    await prisma.$transaction([
      prisma.call.update({
        where: { id },
        data: {
          endedAt: endAt,
          durationSeconds,
          billableDurationSeconds: durationSeconds,
          interpreterNotes,
        },
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

    // Terminate the Twilio Conference so all participants (interpreter, phone guests) are disconnected
    if (call.roomId.startsWith('rolling-')) {
      try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const endAuthToken = process.env.TWILIO_AUTH_TOKEN;
        if (accountSid && endAuthToken) {
          const { default: twilioSdk } = await import('twilio');
          const twilioClient = twilioSdk(accountSid, endAuthToken);
          const conferences = await twilioClient.conferences.list({
            friendlyName: call.roomId,
            status: 'in-progress',
            limit: 1,
          });
          if (conferences[0]) {
            await conferences[0].update({ status: 'completed' });
          }
        }
      } catch (confErr) {
        console.error('Conference termination error (non-fatal):', confErr);
      }
    }

    // Delete the Daily room to disconnect ALL participants (client, interpreter, guests).
    // Skip for phone OPI — Twilio conference ends when interpreter disconnects (endConferenceOnExit).
    if (!call.roomId.startsWith('rolling-')) {
      const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
      await deleteDailyRoom(roomName);
    }

    const { logAudit } = await import('@/lib/audit');
    logAudit({ userId, action: 'call_ended', entityType: 'call', entityId: id, metadata: { durationSeconds, jobId: call.jobId, endedBy: role } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('End call error:', e);
    const msg = e instanceof Error ? e.message : 'Failed to end call';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
