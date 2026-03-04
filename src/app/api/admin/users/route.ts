import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let users: { id: string; email: string; name: string; role: string; approvedAt: Date | null; rejectedAt: Date | null; createdAt: Date }[];
    try {
      users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, approvedAt: true, rejectedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch (prismaErr) {
      console.warn('Admin users fallback (approvedAt/rejectedAt may be missing):', prismaErr);
      const basic = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      users = basic.map((u) => ({ ...u, approvedAt: null, rejectedAt: null }));
    }

    return NextResponse.json(users);
  } catch (e) {
    console.error('Admin users API error:', e);
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
  }
}
