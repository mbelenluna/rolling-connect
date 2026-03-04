import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const userId = (session.user as { id?: string }).id;

  const job = await prisma.job.findFirst({
    where: { id: jobId },
    include: { request: true, call: true, assignedInterpreter: { select: { name: true } } },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.assignedInterpreterId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!job.call) return NextResponse.json({ error: 'Call not found' }, { status: 404 });

  return NextResponse.json({
    jobId: job.id,
    callId: job.call.id,
    durationSeconds: job.call.durationSeconds,
    interpreterNotes: job.call.interpreterNotes,
  });
}
