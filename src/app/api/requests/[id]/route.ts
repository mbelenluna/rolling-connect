import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LOG_PREFIX = '[requests GET]';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    console.warn(LOG_PREFIX, 'Unauthorized: no session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const request = await prisma.interpretationRequest.findFirst({
    where: { id },
    include: {
      jobs: {
        include: {
          assignedInterpreter: { select: { id: true, name: true } },
          call: { select: { id: true, durationSeconds: true, clientRating: true, clientComments: true } },
        },
      },
      organization: { select: { name: true } },
    },
  });

  if (!request) {
    console.warn(LOG_PREFIX, 'Not found', { requestId: id });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const role = (session.user as { role?: string }).role;
  if (role === 'client') {
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId: request.organizationId, userId: (session.user as { id?: string }).id },
    });
    if (!member) {
      console.warn(LOG_PREFIX, 'Forbidden: not org member', { requestId: id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Log status for matching-flow debugging (matching/offered/assigned transitions)
  if (['matching', 'offered', 'assigned', 'in_call'].includes(request.status)) {
    console.log(LOG_PREFIX, 'Status', { requestId: id, status: request.status });
  }

  return NextResponse.json(request);
}
