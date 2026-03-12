import { NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/invite-token';
import crypto from 'crypto';
const { create: createToken } = require('../../../../../lib/speech-token-store');

export const dynamic = 'force-dynamic';

/**
 * GET /api/calls/[id]/guest-speech-token?inviteToken=xxx
 * Returns a short-lived token for the speech WebSocket (guest, no auth).
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

  const token = crypto.randomBytes(32).toString('hex');
  createToken(token, { role: 'guest', callId });

  return NextResponse.json({ token });
}
