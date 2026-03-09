/**
 * Debug endpoint to verify Twilio Access Token generation.
 * GET /api/debug/twilio-token — returns token generation status and decoded claims (no secrets).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createTwilioVoiceToken } from '@/lib/twilio-token';

export const dynamic = 'force-dynamic';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const identity = userId ? `interpreter-${userId}` : 'interpreter-debug';

  const result = createTwilioVoiceToken(identity, 3600);

  if ('error' in result) {
    return NextResponse.json({
      success: false,
      error: result.error,
      identity,
      hint: 'Add TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET to Vercel env. Create API Key at console.twilio.com → Account → API keys.',
    });
  }

  const payload = decodeJwtPayload(result.token);
  const now = Math.floor(Date.now() / 1000);
  const exp = (payload?.exp as number) ?? 0;

  return NextResponse.json({
    success: true,
    identity,
    tokenLength: result.token.length,
    decoded: payload
      ? {
          iss: payload.iss,
          sub: payload.sub,
          jti: payload.jti,
          identity: payload.identity,
          exp,
          expInFuture: exp > now,
          grants: payload.grants ? Object.keys(payload.grants as object) : [],
        }
      : null,
    note: 'Token generated successfully. Do not expose full JWT in logs or responses.',
  });
}
