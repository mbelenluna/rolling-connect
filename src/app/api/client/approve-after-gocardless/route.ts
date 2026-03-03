import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { registrationPath: true, approvedAt: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (user.approvedAt) return NextResponse.json({ ok: true });
  if (user.registrationPath !== 'gocardless') {
    return NextResponse.json({ error: 'Invalid registration path' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { approvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
