import { NextResponse } from 'next/server';

/**
 * Interpreter can cancel their assigned job (e.g. when call fails). Frees themselves.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');
  const { cancelJobAndRequest } = await import('@/lib/cancel-job');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const userId = (session.user as { id?: string }).id!;

  const job = await prisma.job.findFirst({
    where: { id: jobId },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.assignedInterpreterId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ok = await cancelJobAndRequest(jobId);
  return NextResponse.json({ success: ok, message: 'Call canceled. You are now free for new offers.' });
}
