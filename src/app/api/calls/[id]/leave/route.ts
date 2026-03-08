/**
 * POST /api/calls/[id]/leave
 * Interpreter leaves the call (self only). Call stays active; client remains connected.
 * Billing pauses. Interpreter can rejoin later.
 */
import { NextResponse } from 'next/server';
import { endBillableInterval } from '@/lib/call-billing';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: callId } = await params;
  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;

  const call = await prisma.call.findFirst({
    where: { id: callId },
    include: { job: true },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (call.job.assignedInterpreterId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (call.endedAt != null) return NextResponse.json({ error: 'Call already ended' }, { status: 400 });

  await endBillableInterval(callId);

  return NextResponse.json({ success: true, message: 'You have left the call. You can rejoin from your dashboard.' });
}
