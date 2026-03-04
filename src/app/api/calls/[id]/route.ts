import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const call = await prisma.call.findFirst({
    where: { id },
    include: { job: { include: { request: true } } },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;
  const isInterpreter = call.job.assignedInterpreterId === userId;
  const isClient = call.job.request.createdByUserId === userId;

  if (!isInterpreter && !isClient && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: call.id,
    durationSeconds: call.durationSeconds,
    interpreterNotes: call.interpreterNotes,
    clientRating: call.clientRating,
    clientComments: call.clientComments,
  });
}
