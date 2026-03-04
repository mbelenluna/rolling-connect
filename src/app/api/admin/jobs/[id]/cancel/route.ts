import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Admin: Cancel a job to free the interpreter (e.g. for stuck/stale assignments)
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');
  const { cancelJobAndRequest } = await import('@/lib/cancel-job');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: jobId } = await params;

  const job = await prisma.job.findFirst({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ok = await cancelJobAndRequest(jobId);
  return NextResponse.json({ success: ok, message: 'Job canceled. Interpreter is now free.' });
}
