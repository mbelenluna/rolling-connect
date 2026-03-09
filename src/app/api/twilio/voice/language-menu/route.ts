/**
 * Dedicated route for language menu. Called via Redirect from validate_client
 * after Say + Pause to ensure a fresh request context (no DTMF carryover).
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
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

const LANGUAGE_MENU_PROMPT =
  'For Spanish, press 1. For Chinese, press 2. For Korean, press 3. For Russian, press 4. For Vietnamese, press 5. For Portuguese, press 6. For Haitian Creole, press 7. For Arabic, press 8. For other languages, press 9.';

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

  console.log('[twilio/language-menu] REQUEST', { url: req.url, clientId, digits, method: req.method });

  logVoiceRequest('language-menu', {
    url: req.url,
    clientId,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
  });

  if (!clientId) {
    console.log('[twilio/language-menu] missing_clientId');
    logVoiceResponse('language-menu', { branch: 'missing_clientId' });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid session. Please call again. Goodbye.</Say><Hangup/></Response>`;
    return twiml(xml);
  }

  // actionOnEmptyResult so timeout also POSTs to select-language (handles empty Digits cleanly)
  const selectUrl = escapeXml(`${base}/api/twilio/voice/select-language?clientId=${encodeURIComponent(clientId)}`);
  const langXml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" timeout="10" input="dtmf" method="POST" action="${selectUrl}" actionOnEmptyResult="true"><Say voice="alice" language="en-US">${escapeXml(LANGUAGE_MENU_PROMPT)}</Say></Gather></Response>`;

  console.log('[twilio/language-menu] EXACT_TWIML_RETURNED', { fullXml: langXml });
  logVoiceResponse('language-menu', { branch: 'menu_returned', twimlPreview: langXml });
  return twiml(langXml);
}

export async function GET(req: NextRequest) {
  return handleLanguageMenu(req);
}

export async function POST(req: NextRequest) {
  return handleLanguageMenu(req);
}
