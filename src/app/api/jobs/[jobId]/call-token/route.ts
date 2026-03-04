import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDailyMeetingToken } from '@/lib/daily';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;
  const userId = (session.user as { id?: string }).id!;
  const userName = (session.user as { name?: string }).name || 'Interpreter';

  const job = await prisma.job.findFirst({
    where: { id: jobId },
    include: { request: true, call: true },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.assignedInterpreterId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!job.call) return NextResponse.json({ error: 'Call not created' }, { status: 500 });

  const roomName = `rolling-${job.call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const tokenResult = await createDailyMeetingToken({
    roomName,
    userName: `${userName} (Interpreter)`,
    userId,
    serviceType: job.request.serviceType,
  });

  const dailyToken = 'token' in tokenResult ? tokenResult.token : null;
  const dailyError = 'error' in tokenResult ? tokenResult.error : null;

  const domain = (process.env.DAILY_DOMAIN || 'rolling-connect').trim();
  const dailyUrl = dailyToken ? `https://${domain}.daily.co/${roomName}?t=${dailyToken}` : null;

  return NextResponse.json({
    callId: job.call.id,
    roomId: job.call.roomId,
    roomName,
    token: dailyToken || `token_${job.call.roomId}_${userId}`,
    dailyUrl,
    dailyError,
    serviceType: job.request.serviceType,
  });
}
