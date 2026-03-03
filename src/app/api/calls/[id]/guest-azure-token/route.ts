import { NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/invite-token';

/**
 * GET /api/calls/[id]/guest-azure-token?inviteToken=xxx
 * Returns Azure Speech token for guests (no auth required).
 * Requires valid inviteToken from the invite link.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params;
  const url = new URL(req.url);
  const inviteToken = url.searchParams.get('inviteToken');

  if (!inviteToken) {
    return NextResponse.json({ error: 'Missing inviteToken' }, { status: 400 });
  }

  const verifiedCallId = verifyInviteToken(inviteToken);
  if (!verifiedCallId || verifiedCallId !== callId) {
    return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 401 });
  }

  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    return NextResponse.json(
      { error: 'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set in .env' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Azure token failed: ${res.status} - ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const token = await res.text();
    return NextResponse.json({ token, region });
  } catch (e) {
    console.error('Azure speech token error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to get token' },
      { status: 500 }
    );
  }
}
