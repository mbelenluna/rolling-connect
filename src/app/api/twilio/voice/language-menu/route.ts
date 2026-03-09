/**
 * Dedicated route for language menu. Called via Redirect from validate_client
 * to ensure a fresh request context (no digit carryover from client code entry).
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { IVR_LANGUAGE_MAP } from '@/lib/phone-request';
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildLanguageMenu(): string {
  const lines = Object.entries(IVR_LANGUAGE_MAP)
    .map(([digit, v]) => `Press ${digit} for ${v.spokenName}.`)
    .join(' ');
  return `Select your language. ${lines}`;
}

/** Handle GET (e.g. if redirect uses GET) or POST. */
async function handleLanguageMenu(req: NextRequest): Promise<NextResponse> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Service error. Goodbye.</Say><Hangup/></Response>`);
  }

  const isPost = req.method === 'POST';
  const body = isPost ? await req.text() : '';
  const params = isPost ? Object.fromEntries(new URLSearchParams(body)) : Object.fromEntries(req.nextUrl.searchParams);
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const base = (process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
  const search = req.nextUrl.search || '';
  const canonicalUrl = `${base}/api/twilio/voice/language-menu${search}`;

  if (signature) {
    const valid =
      twilio.validateRequest(authToken, signature, canonicalUrl, params) ||
      (req.url?.startsWith('http') && twilio.validateRequest(authToken, signature, req.url, params));
    if (!valid) {
      console.warn('[twilio/language-menu] Invalid signature', { canonicalUrl, reqUrl: req.url });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const clientId = req.nextUrl.searchParams.get('clientId') ?? '';
  const digits = params.Digits ?? '';

  logVoiceRequest('language-menu', {
    url: req.url,
    clientId,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
  });

  if (!clientId) {
    logVoiceResponse('language-menu', { branch: 'missing_clientId' });
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid session. Please call again. Goodbye.</Say><Hangup/></Response>`
    );
  }

  const actionUrl = escapeXml(`${base}/api/twilio/voice/incoming?step=create_request&clientId=${encodeURIComponent(clientId)}`);
  const langMenu = buildLanguageMenu();
  const langXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" timeout="15" action="${actionUrl}" method="POST" input="dtmf"><Say voice="alice" language="en-US">${escapeXml(langMenu)}</Say></Gather><Say voice="alice" language="en-US">We did not receive your language selection. Goodbye.</Say><Hangup/></Response>`;

  logVoiceResponse('language-menu', { branch: 'menu_returned', twimlPreview: langXml, twimlLength: langXml.length });
  return twiml(langXml);
}

export async function GET(req: NextRequest) {
  return handleLanguageMenu(req);
}

export async function POST(req: NextRequest) {
  return handleLanguageMenu(req);
}
