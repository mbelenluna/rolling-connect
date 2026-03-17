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

// Use HOLD_MUSIC_URL env var if set, otherwise fall back to a pure Pause (no external URL dependency).
const HOLD_MUSIC_URL = process.env.HOLD_MUSIC_URL || '';

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

// Safe fallback TwiML — returned if anything throws, prevents Twilio "application error"
function safeFallback(holdUrl: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="30"/>
  <Redirect method="POST">${holdUrl}</Redirect>
</Response>`;
  return twiml(xml);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  logVoiceRequest('hold-message', { method: 'GET', callSid: params.CallSid });
  return buildHoldResponse(params.CallSid || '', params.Digits || '', 'GET');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));
    const callSid = params.CallSid || '';
    const digits = params.Digits || '';
    logVoiceRequest('hold-message', { method: 'POST', callSid, digits });
    return await buildHoldResponse(callSid, digits, 'POST');
  } catch (err) {
    console.error('[hold-message] Unhandled error, returning safe fallback:', err);
    const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    return safeFallback(`${base}/api/twilio/voice/hold-message`);
  }
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

  // Within timeout: play hold music (if URL configured) or pause, then re-check.
  // Using <Pause> + <Redirect> instead of <Play> + <Redirect> avoids rapid redirect
  // loops if the music URL is unreachable (Twilio skips a failed <Play> instantly,
  // causing tight loops that crash the server and trigger "application error").
  const escapedHoldUrl = escapeXml(holdUrl);
  let xml: string;
  if (HOLD_MUSIC_URL) {
    const musicUrl = escapeXml(HOLD_MUSIC_URL);
    // <Pause length="5"> after Play acts as a safety buffer: if Play fails and is
    // skipped instantly, the 5-second pause prevents a tight redirect loop.
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play loop="1">${musicUrl}</Play>
  <Pause length="5"/>
  <Redirect method="POST">${escapedHoldUrl}</Redirect>
</Response>`;
    logVoiceResponse('hold-message', { branch: 'music_loop' });
  } else {
    // No music URL — use a 30-second silent pause. Completely reliable, no external dependency.
    xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="30"/>
  <Redirect method="POST">${escapedHoldUrl}</Redirect>
</Response>`;
    logVoiceResponse('hold-message', { branch: 'pause_loop' });
  }
  return twiml(xml);
}
