import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    const { prisma } = await import('@/lib/prisma');
    const { sendApprovalEmail } = await import('@/lib/email');

    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user.role !== 'client') return NextResponse.json({ error: 'Only clients can be approved' }, { status: 400 });

    await prisma.user.update({
      where: { id },
      data: { approvedAt: new Date(), rejectedAt: null },
    });

    sendApprovalEmail(user.email, user.name, 'client').catch((e) =>
      console.error('Approval email failed:', e)
    );

    const { logAudit } = await import('@/lib/audit');
    logAudit({ userId: (session.user as { id?: string }).id, action: 'user_approved', entityType: 'user', entityId: id, metadata: { targetEmail: user.email, targetRole: 'client' } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Approve client error:', err);
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json(
      { error: msg.includes('approved_at') || msg.includes('rejected_at') ? 'Database schema may be outdated. Run: npx prisma db push' : msg },
      { status: 500 }
    );
  }
}
