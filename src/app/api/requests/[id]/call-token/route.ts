import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDailyMeetingToken } from '@/lib/daily';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: requestId } = await params;

  const request = await prisma.interpretationRequest.findFirst({
    where: { id: requestId },
    include: { jobs: { include: { call: true } } },
  });

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id!;
  const userName = (session.user as { name?: string }).name || 'Participant';

  const job = request.jobs.find((j) => j.status === 'assigned' || j.status === 'in_call');
  if (!job) return NextResponse.json({ error: 'No active call' }, { status: 400 });

  const isClient = role === 'client' && request.createdByUserId === userId;
  const isInterpreter = role === 'interpreter' && job.assignedInterpreterId === userId;
  if (!isClient && !isInterpreter && role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const call = job.call;
  if (!call) return NextResponse.json({ error: 'Call not created' }, { status: 500 });

  const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const tokenResult = await createDailyMeetingToken({
    roomName,
    userName: `${userName} (${role})`,
    userId,
    serviceType: request.serviceType,
  });

  const dailyToken = 'token' in tokenResult ? tokenResult.token : null;
  const dailyError = 'error' in tokenResult ? tokenResult.error : null;

  const domain = (process.env.DAILY_DOMAIN || 'rolling-connect').trim();
  const dailyUrl = dailyToken ? `https://${domain}.daily.co/${roomName}?t=${dailyToken}` : null;

  return NextResponse.json({
    callId: call.id,
    roomId: call.roomId,
    roomName,
    token: dailyToken || `token_${call.roomId}_${userId}`,
    dailyUrl,
    dailyError,
    serviceType: request.serviceType,
    interpretationType: request.interpretationType ?? 'human',
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
  });
}
