import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** GET — org usage report for billing/owner org members */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Find the org(s) this user belongs to with billing or owner role
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, role: { in: ['billing', 'owner'] } },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (memberships.length === 0) {
    return NextResponse.json({ error: 'No billing access' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const orgId = searchParams.get('orgId') || memberships[0].organizationId;

  // Verify user has access to this org
  const membership = memberships.find((m) => m.organizationId === orgId);
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const where: Record<string, unknown> = { organizationId: orgId, status: 'completed' };
  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate + 'T00:00:00');
    if (endDate) dateFilter.lte = new Date(endDate + 'T23:59:59');
    where.createdAt = dateFilter;
  }

  const requests = await prisma.interpretationRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      jobs: {
        include: {
          call: {
            select: {
              durationSeconds: true,
              billableDurationSeconds: true,
              startedAt: true,
              endedAt: true,
            },
          },
          assignedInterpreter: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({ org: membership.organization, requests });
}
