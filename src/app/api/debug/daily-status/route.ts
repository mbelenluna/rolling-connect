import { NextResponse } from 'next/server';
import { createDailyMeetingToken } from '@/lib/daily';

/**
 * Debug endpoint to verify Daily.co configuration.
 * Visit /api/debug/daily-status to see if env vars are set and token creation works.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  const domain = process.env.DAILY_DOMAIN?.trim();

  const effectiveDomain = domain || 'rolling-connect';
  const config = {
    DAILY_API_KEY: apiKey ? `Set (${apiKey.slice(0, 8)}...)` : 'NOT SET',
    DAILY_DOMAIN: domain || 'NOT SET (will use "rolling-connect")',
    dailyUrlExample: `https://${effectiveDomain}.daily.co/room-name?t=token`,
    note: 'DAILY_DOMAIN must match your Daily dashboard account. Find it at dashboard.daily.co → your account settings.',
  };

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      config,
      error: 'DAILY_API_KEY is not set. Add it to .env and restart the server.',
    });
  }

  const result = await createDailyMeetingToken({
    roomName: 'test-room-debug',
    userName: 'Debug Test',
    userId: 'debug-user',
  });

  if ('error' in result) {
    return NextResponse.json({
      ok: false,
      config,
      error: result.error,
    });
  }

  const testUrl = `https://${effectiveDomain}.daily.co/test-room-debug?t=${result.token}`;

  return NextResponse.json({
    ok: true,
    config,
    message: 'Daily.co is configured correctly. Room creation and token succeeded.',
    testJoinUrl: testUrl,
    note: 'If you see "meeting does not exist" when joining, verify DAILY_DOMAIN matches your Daily account (dashboard.daily.co).',
  });
}
