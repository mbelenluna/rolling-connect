import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelJobAndRequest } from '@/lib/cancel-job';

/**
 * Admin: Cancel a job to free the interpreter (e.g. for stuck/stale assignments)
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: jobId } = await params;

  const job = await prisma.job.findFirst({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ok = await cancelJobAndRequest(jobId);
  return NextResponse.json({ success: ok, message: 'Job canceled. Interpreter is now free.' });
}
