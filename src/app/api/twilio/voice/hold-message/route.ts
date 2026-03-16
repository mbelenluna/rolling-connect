/**
 * TwiML for conference waitUrl: plays hold music while caller waits for interpreter.
 * After 60 seconds: "Unfortunately all interpreters are busy. Press 1 to wait another minute, or press 2 to end."
 * Press 2: "Apologies for the inconvenience. Please try again later." (hangup)
 * Press 1: extends wait by 60 seconds, returns to hold music.
 *
 * Industry practice (LanguageLine, Boostlingo): hold music, fast connection times, clear timeout options.
 */
import { NextRequest, NextResponse } from 'next/server';
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';
import { getTimeoutAt, setTimeoutAt, extendTimeout } from '@/lib/hold-timeout-store';

export const dynamic = 'force-dynamic';

const HOLD_TIMEOUT_MS = 60_000; // 60 seconds before offering Press 1/2
const EXTEND_MS = 60_000; // Press 1 adds 60 seconds

// Twilio's classical hold music (30–60 sec track). Override with HOLD_MUSIC_URL env.
const DEFAULT_HOLD_MUSIC =
  process.env.HOLD_MUSIC_URL ||
  'https://s3.amazonaws.com/com.twilio.sounds.music/classical/01.mp3';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  logVoiceRequest('hold-message', { method: 'GET', callSid: params.CallSid });
  return buildHoldResponse(params.CallSid || '', params.Digits || '', 'GET');
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const callSid = params.CallSid || '';
  const digits = params.Digits || '';
  logVoiceRequest('hold-message', { method: 'POST', callSid, digits });
  return buildHoldResponse(callSid, digits, 'POST');
}

async function buildHoldResponse(
  callSid: string,
  digits: string,
  method: string
): Promise<NextResponse> {
  const base = (process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '');
  const holdUrl = `${base}/api/twilio/voice/hold-message`;

  // Press 2: end call
  if (digits === '2') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Apologies for the inconvenience. Please try again later.</Say>
  <Hangup/>
</Response>`;
    logVoiceResponse('hold-message', { branch: 'press_2_hangup' });
    return twiml(xml);
  }

  // Press 1: extend wait, return to music
  if (digits === '1') {
    extendTimeout(callSid, EXTEND_MS);
    logVoiceResponse('hold-message', { branch: 'press_1_extend' });
  }

  // Initialize or check timeout
  let timeoutAt = getTimeoutAt(callSid);
  if (timeoutAt === undefined) {
    timeoutAt = Date.now() + HOLD_TIMEOUT_MS;
    setTimeoutAt(callSid, timeoutAt);
  }

  const now = Date.now();

  // Past timeout: offer Press 1 or 2
  if (now >= timeoutAt) {
    const actionUrl = escapeXml(holdUrl);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Unfortunately, all our interpreters are busy right now. Please press 1 if you wish to continue waiting for another minute, or press 2 to end the call.</Say>
  <Gather numDigits="1" timeout="15" input="dtmf" action="${actionUrl}" method="POST">
    <Pause length="5"/>
  </Gather>
  <Say voice="alice" language="en-US">We did not receive your selection. Please try again later.</Say>
  <Hangup/>
</Response>`;
    logVoiceResponse('hold-message', { branch: 'timeout_gather' });
    return twiml(xml);
  }

  // Within timeout: play hold music, then re-check
  const musicUrl = escapeXml(DEFAULT_HOLD_MUSIC);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="1">${musicUrl}</Play>
  <Redirect method="POST">${holdUrl}</Redirect>
</Response>`;
  logVoiceResponse('hold-message', { branch: 'music_loop' });
  return twiml(xml);
}
