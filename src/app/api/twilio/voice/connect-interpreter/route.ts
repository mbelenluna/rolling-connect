/**
 * TwiML endpoint for interpreter's browser Voice SDK.
 * When interpreter connects via Twilio Device, Twilio calls this URL.
 * Returns TwiML to dial the interpreter into the conference.
 *
 * Configure a TwiML App in Twilio Console with Voice URL = https://YOURDOMAIN.com/api/twilio/voice/connect-interpreter
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio/connect-interpreter] TWILIO_AUTH_TOKEN not set');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Service error. Please try again later.</Say><Hangup/></Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const fullUrl = `${baseUrl.replace(/\/$/, '')}/api/twilio/voice/connect-interpreter`;

  if (signature && !twilio.validateRequest(authToken, signature, fullUrl, params)) {
    console.warn('[twilio/connect-interpreter] Invalid signature');
    return new NextResponse('Forbidden', { status: 403 });
  }

  const conferenceName = params.conferenceName || params.ConferenceName || '';
  if (!conferenceName) {
    console.warn('[twilio/connect-interpreter] Missing conferenceName');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid request.</Say><Hangup/></Response>`;
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }

  // endConferenceOnExit=false: interpreter can leave without ending the call; client stays connected
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial><Conference beep="onEnter" endConferenceOnExit="false" participantLabel="interpreter">${escapeXml(conferenceName)}</Conference></Dial></Response>`;
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
