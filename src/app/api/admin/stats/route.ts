import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [users, requests, jobs] = await Promise.all([
    prisma.user.count(),
    prisma.interpretationRequest.count(),
    prisma.job.count({ where: { status: { in: ['offered', 'assigned', 'in_call'] } } }),
  ]);

  return NextResponse.json({ users, requests, jobs });
}
