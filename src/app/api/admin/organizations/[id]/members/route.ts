import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/organizations/[id]/members
 * Body: { userId, role: 'owner' | 'member' | 'billing' }
 * Adds a user to the org with the given role, or updates their role if already a member.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orgId } = await params;
  const { userId, role } = await req.json();

  if (!userId || !['owner', 'member', 'billing'].includes(role)) {
    return NextResponse.json({ error: 'userId and a valid role are required' }, { status: 400 });
  }

  // Verify the user and org exist
  const [user, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } }),
  ]);

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    update: { role },
    create: { organizationId: orgId, userId, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const { logAudit } = await import('@/lib/audit');
  logAudit({ userId: (session?.user as { id?: string })?.id, action: 'org_member_assigned', entityType: 'organization', entityId: orgId, metadata: { targetUserId: userId, targetEmail: member.user.email, role, orgName: org.name } });

  return NextResponse.json(member);
}

/**
 * DELETE /api/admin/organizations/[id]/members?userId=xxx
 * Removes a user from the org entirely.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if ((session?.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orgId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await prisma.organizationMember.deleteMany({
    where: { organizationId: orgId, userId },
  });

  return NextResponse.json({ ok: true });
}
