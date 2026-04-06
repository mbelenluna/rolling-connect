import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { interpreterPayCentsWithRates } from '@/lib/billing-rates';

/**
 * GET /api/interpreter/history
 * Returns completed jobs for the current interpreter with call duration and pay.
 * Pay is calculated server-side using the interpreter's individually-set OPI/VRI rates.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  if (role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [jobs, profile] = await Promise.all([
    prisma.job.findMany({
      where: { assignedInterpreterId: userId, status: 'completed' },
      include: {
        request: { select: { sourceLanguage: true, targetLanguage: true, serviceType: true, specialty: true, createdAt: true, interpretationType: true } },
        call: { select: { durationSeconds: true, billableDurationSeconds: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.interpreterProfile.findUnique({
      where: { userId },
      select: { opiRateCents: true, vriRateCents: true },
    }),
  ]);

  const result = jobs.map((j) => {
    const duration = j.call?.billableDurationSeconds ?? j.call?.durationSeconds ?? 0;
    const paymentCents = duration > 0
      ? interpreterPayCentsWithRates(
          duration,
          j.request.serviceType,
          j.request.targetLanguage,
          profile?.opiRateCents,
          profile?.vriRateCents,
          (j.request.interpretationType as 'human' | 'ai') ?? 'human'
        )
      : 0;
    return { ...j, paymentCents };
  });

  return NextResponse.json(result);
}
