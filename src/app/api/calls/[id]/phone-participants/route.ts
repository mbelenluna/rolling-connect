import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getServerSession } = await import('next-auth');
  const { authOptions } = await import('@/lib/auth');
  const { prisma } = await import('@/lib/prisma');

  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: callId } = await params;

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!call.roomId.startsWith('rolling-')) return NextResponse.json({ participants: [] });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return NextResponse.json({ participants: [] });

  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);

    const conferences = await client.conferences.list({
      friendlyName: call.roomId,
      status: 'in-progress',
      limit: 1,
    });

    if (!conferences[0]) return NextResponse.json({ participants: [] });

    const participants = await client
      .conferences(conferences[0].sid)
      .participants.list();

    // Web participants have label 'interpreter' or 'client' (set by connect-interpreter TwiML).
    // PSTN phone guests have no label — filter to those only.
    const phoneParticipants = participants.filter(
      (p) => !p.label || (p.label !== 'interpreter' && p.label !== 'client')
    );

    const results = await Promise.all(
      phoneParticipants.map(async (p) => {
        try {
          const callDetails = await client.calls(p.callSid).fetch();
          return { callSid: p.callSid, from: callDetails.from };
        } catch {
          return { callSid: p.callSid, from: 'Unknown number' };
        }
      })
    );

    return NextResponse.json({ participants: results });
  } catch (err) {
    console.error('[phone-participants]', err);
    return NextResponse.json({ participants: [] });
  }
}
