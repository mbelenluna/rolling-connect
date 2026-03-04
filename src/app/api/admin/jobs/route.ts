import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const jobs = await prisma.job.findMany({
    include: {
      request: { select: { sourceLanguage: true, targetLanguage: true, specialty: true, serviceType: true } },
      assignedInterpreter: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(jobs);
}
