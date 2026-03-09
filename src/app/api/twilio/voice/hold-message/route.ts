/**
 * TwiML for conference waitUrl: plays hold message while caller waits for interpreter.
 * Twilio may use GET or POST (default is POST); we support both.
 * Only called AFTER caller has joined the conference (post language selection).
 */
import { NextRequest, NextResponse } from 'next/server';
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

function twimlResponse(method: string) {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const holdUrl = `${base.replace(/\/$/, '')}/api/twilio/voice/hold-message`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Please hold while we connect you to an interpreter. Your call is important to us.</Say>
  <Pause length="5"/>
  <Redirect>${holdUrl}</Redirect>
</Response>`;
  logVoiceResponse('hold-message', { branch: method, twimlPreview: xml });
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  console.log('[twilio/hold-message] REQUEST', { method: 'GET', callSid: params.CallSid });
  logVoiceRequest('hold-message', { url: req.url, method: 'GET', callSid: params.CallSid });
  return twimlResponse('GET');
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  console.log('[twilio/hold-message] REQUEST', { method: 'POST', callSid: params.CallSid });
  logVoiceRequest('hold-message', { url: req.url, method: 'POST', callSid: params.CallSid, bodyKeys: Object.keys(params) });
  return twimlResponse('POST');
}
