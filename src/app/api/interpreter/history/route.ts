import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/interpreter/history
 * Returns completed jobs for the current interpreter with call duration and pay.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  if (role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const jobs = await prisma.job.findMany({
    where: {
      assignedInterpreterId: userId,
      status: 'completed',
    },
    include: {
      request: { select: { sourceLanguage: true, targetLanguage: true, serviceType: true, specialty: true, createdAt: true } },
      call: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(jobs);
}
