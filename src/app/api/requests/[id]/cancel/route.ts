import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelJobAndRequest } from '@/lib/cancel-job';

/**
 * Client can cancel their request (e.g. when call fails). Frees the interpreter.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: requestId } = await params;
  const userId = (session.user as { id?: string }).id!;

  const request = await prisma.interpretationRequest.findFirst({
    where: { id: requestId },
    include: { jobs: true },
  });

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (request.createdByUserId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const job = request.jobs.find((j) => ['offered', 'assigned', 'in_call'].includes(j.status));
  if (!job) return NextResponse.json({ error: 'No active job to cancel' }, { status: 400 });

  const ok = await cancelJobAndRequest(job.id);
  return NextResponse.json({ success: ok, message: 'Call canceled. Interpreter is now free.' });
}
