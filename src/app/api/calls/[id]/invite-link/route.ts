import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDailyMeetingToken } from '@/lib/daily';
import { createInviteToken } from '@/lib/invite-token';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calls/[id]/invite-link
 * Creates a guest token for the call room so the caller can share an invite link.
 * Only call participants (client or interpreter) can request this.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: callId } = await params;
  const userId = (session.user as { id?: string }).id!;

  const call = await prisma.call.findFirst({
    where: { id: callId },
    include: { job: { include: { request: true } } },
  });

  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isClient = call.job.request.createdByUserId === userId;
  const isInterpreter = call.job.assignedInterpreterId === userId;
  if (!isClient && !isInterpreter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roomName = `rolling-${call.roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const guestUserId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour

  const tokenResult = await createDailyMeetingToken({
    roomName,
    userName: 'Guest',
    userId: guestUserId,
    exp,
    serviceType: call.job.request.serviceType,
  });

  if ('error' in tokenResult) {
    return NextResponse.json({ error: tokenResult.error }, { status: 500 });
  }

  const domain = (process.env.DAILY_DOMAIN || 'rolling-connect').trim();
  const dailyUrl = `https://${domain}.daily.co/${roomName}?t=${tokenResult.token}`;

  // Return our app URL so invitees see the translation UI (not raw Daily)
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const requestId = call.job.request.id;
  const inviteToken = createInviteToken(callId);
  const appUrl = `${baseUrl}/join-invite?u=${encodeURIComponent(dailyUrl)}&callId=${callId}&requestId=${requestId}&inviteToken=${inviteToken}`;

  return NextResponse.json({ url: appUrl });
}
