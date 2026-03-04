import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id?: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { approvedAt: true, rejectedAt: true },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const approved = user.approvedAt != null;
  const rejected = user.rejectedAt != null;

  return NextResponse.json({
    approved,
    rejected,
    pending: !approved && !rejected,
  });
}
