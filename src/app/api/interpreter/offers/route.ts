import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelStaleJobs } from '@/lib/cancel-job';

/**
 * Polling fallback: get active offers for the current interpreter.
 * Use when Socket.io isn't available or as backup.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id?: string }).id!;

  cancelStaleJobs().catch(() => {});

  const jobs = await prisma.job.findMany({
    where: {
      status: 'offered',
      offerExpiresAt: { gt: new Date() },
    },
    include: { request: true },
  });

  const myJobs = jobs.filter((j) => {
    const ids = (j.offeredToIds as string[]) || [];
    return ids.includes(userId);
  });

  const offers = myJobs.map((j) => ({
    jobId: j.id,
    requestId: j.requestId,
    languagePair: `${j.request.sourceLanguage} → ${j.request.targetLanguage}`,
    specialty: j.request.specialty,
    estimatedDurationMinutes: j.request.estimatedDurationMinutes,
    notes: j.request.notes,
    urgency: j.request.urgency,
    expiresAt: j.offerExpiresAt?.toISOString(),
  }));

  return NextResponse.json(offers);
}
