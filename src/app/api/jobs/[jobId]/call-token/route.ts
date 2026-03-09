import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Phone-originated OPI: roomId is the Twilio conference name (starts with rolling-) */
function isPhoneOriginated(roomId: string): boolean {
  return roomId.startsWith('rolling-');
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');
  const { createDailyMeetingToken } = await import('@/lib/daily');
  const { createTwilioVoiceToken } = await import('@/lib/twilio-token');

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

  const roomId = job.call.roomId;
  const conferenceName = roomId;

  if (isPhoneOriginated(roomId)) {
    // Interpreter joins Twilio Conference (caller is already on the line)
    const tokenResult = createTwilioVoiceToken(`interpreter-${userId}`);
    if ('error' in tokenResult) {
      return NextResponse.json(
        {
          error: tokenResult.error,
          callId: job.call.id,
          roomId,
          serviceType: job.request.serviceType,
          dailyUrl: null,
          dailyError: tokenResult.error,
          isPhoneOriginated: true,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      callId: job.call.id,
      roomId,
      serviceType: job.request.serviceType,
      dailyUrl: null,
      dailyError: null,
      isPhoneOriginated: true,
      twilioToken: tokenResult.token,
      conferenceName,
    });
  }

  // Web-originated: use Daily
  const roomName = `rolling-${roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
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
