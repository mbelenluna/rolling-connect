/**
 * Returns current IVR version. Use to verify production is serving latest code.
 * GET https://rolling-connect.com/api/twilio/voice/version
 */
import { NextResponse } from 'next/server';
import { getIvrVersion } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: getIvrVersion(),
    ts: new Date().toISOString(),
  });
}
