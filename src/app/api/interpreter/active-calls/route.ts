/**
 * GET /api/interpreter/active-calls
 * Returns calls assigned to the interpreter that are still active (client connected, call not ended).
 * Used for "Rejoin Call" on interpreter dashboard.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;
  if (role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const jobs = await prisma.job.findMany({
    where: {
      assignedInterpreterId: userId,
      status: { in: ['assigned', 'in_call'] },
      call: {
        endedAt: null,
      },
    },
    include: {
      request: { select: { sourceLanguage: true, targetLanguage: true, specialty: true, serviceType: true } },
      call: { select: { id: true, roomId: true } },
    },
  });

  const activeCalls = jobs
    .filter((j) => j.call)
    .map((j) => ({
      jobId: j.id,
      callId: j.call!.id,
      roomId: j.call!.roomId,
      languagePair: `${j.request.sourceLanguage} → ${j.request.targetLanguage}`,
      specialty: j.request.specialty,
      serviceType: j.request.serviceType,
    }));

  return NextResponse.json(activeCalls);
}
