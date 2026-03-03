import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const interpreterId = (session.user as { id?: string }).id;
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { jobId } = await params;

  const job = await prisma.job.findFirst({
    where: { id: jobId },
    select: { offeredToIds: true },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const offeredTo = (job.offeredToIds as string[]) || [];
  if (!offeredTo.includes(interpreterId!)) return NextResponse.json({ error: 'Not offered' }, { status: 400 });

  const updated = await prisma.job.updateMany({
    where: { id: jobId },
    data: { offeredToIds: offeredTo.filter((id) => id !== interpreterId) },
  });

  const io = (global as { io?: { to: (room: string) => { emit: (e: string, p: unknown) => void } } }).io;
  io?.to(`user:${interpreterId}`).emit('offer_declined', { jobId });

  return NextResponse.json({ success: true });
}
