import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'client') return NextResponse.json({ error: 'Only clients can be rejected' }, { status: 400 });

    await prisma.user.update({
      where: { id },
      data: { rejectedAt: new Date(), approvedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Reject client error:', err);
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json(
      { error: msg.includes('approved_at') || msg.includes('rejected_at') ? 'Database schema may be outdated. Run: npx prisma db push' : msg },
      { status: 500 }
    );
  }
}
