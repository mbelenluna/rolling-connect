/**
 * Handles language selection from IVR. Called when user presses a digit in the language menu.
 * Valid digit → create request, say "Connecting...", enter conference.
 * Invalid/empty → replay menu or say error and hang up.
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createPhoneRequest, IVR_LANGUAGE_MAP } from '@/lib/phone-request';
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function twimlWithLog(xml: string, branch: string): NextResponse {
  console.log('[twilio/select-language] EXACT_TWIML_RETURNED', { branch, fullXml: xml });
  return twiml(xml);
}

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
    return twiml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Service error. Goodbye.</Say><Hangup/></Response>`);
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const base = (process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
  const search = req.nextUrl.search || '';
  const canonicalUrl = `${base}/api/twilio/voice/select-language${search}`;

  if (signature) {
    const valid =
      twilio.validateRequest(authToken, signature, canonicalUrl, params) ||
      (req.url?.startsWith('http') && twilio.validateRequest(authToken, signature, req.url, params));
    if (!valid) {
      console.warn('[twilio/select-language] Invalid signature', { canonicalUrl, reqUrl: req.url });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const clientId = req.nextUrl.searchParams.get('clientId') ?? '';
  const digits = params.Digits ?? '';
  const digit = digits.trim().replace(/\D/g, '');
  const digitPadded = digit.length === 1 ? `0${digit}` : digit;

  console.log('[twilio/select-language] REQUEST', { url: req.url, clientId, digits, digit, digitPadded });

  logVoiceRequest('select-language', {
    url: req.url,
    clientId,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
  });

  // Empty (timeout) or missing clientId
  if (!digit) {
    logVoiceResponse('select-language', { branch: 'no_digit_timeout' });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">We did not receive your language selection. Goodbye.</Say><Hangup/></Response>`;
    return twimlWithLog(xml, 'no_digit_timeout');
  }

  if (!clientId) {
    logVoiceResponse('select-language', { branch: 'missing_clientId' });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid session. Please call again. Goodbye.</Say><Hangup/></Response>`;
    return twimlWithLog(xml, 'missing_clientId');
  }

  // Look up by 2-digit key (01-60). Accept "1" as "01", "2" as "02", etc.
  const lang = IVR_LANGUAGE_MAP[digitPadded] ?? IVR_LANGUAGE_MAP[digit];
  if (!lang) {
    logVoiceResponse('select-language', { branch: 'invalid_digit', digit });
    const menuUrl = escapeXml(`${base}/api/twilio/voice/language-menu?clientId=${encodeURIComponent(clientId)}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid selection. Please try again.</Say><Redirect method="POST">${menuUrl}</Redirect></Response>`;
    return twimlWithLog(xml, 'invalid_digit_replay_menu');
  }

  // Valid digit: create request and enter conference
  const result = await createPhoneRequest(clientId, digitPadded);

  if (!result.ok) {
    logVoiceResponse('select-language', { branch: `create_error_${result.error}` });
    if (result.error === 'INVALID_CLIENT_ID') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid client ID. Goodbye.</Say><Hangup/></Response>`;
      return twimlWithLog(xml, 'create_error_invalid_client');
    }
    if (result.error === 'ORG_NOT_APPROVED' || result.error === 'NO_OWNER') {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Your account is not set up for phone requests. Please contact your administrator. Goodbye.</Say><Hangup/></Response>`;
      return twimlWithLog(xml, 'create_error_org_not_approved');
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid language selection. Goodbye.</Say><Hangup/></Response>`;
    return twimlWithLog(xml, 'create_error_invalid_language');
  }

  if (result.interpretersMatched === 0) {
    logVoiceResponse('select-language', { branch: 'no_interpreters' });
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Your interpretation request has been received. Unfortunately, no interpreters are available at this time. Please try again later or use our website. Goodbye.</Say><Hangup/></Response>`;
    return twimlWithLog(xml, 'no_interpreters');
  }

  // Success: say connecting, then Dial into conference. Hold music (waitUrl) starts only after caller joins conference.
  logVoiceResponse('select-language', { branch: 'conference_join' });
  const conferenceName = `rolling-${result.jobId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  const waitUrl = `${base}/api/twilio/voice/hold-message`;
  const statusCallback = `${base}/api/twilio/voice/conference-status`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Connecting to an available interpreter. Please hold.</Say><Dial><Conference beep="onEnter" startConferenceOnEnter="true" endConferenceOnExit="true" participantLabel="caller" waitUrl="${escapeXml(waitUrl)}" waitMethod="POST" statusCallback="${escapeXml(statusCallback)}" statusCallbackEvent="join leave">${escapeXml(conferenceName)}</Conference></Dial></Response>`;
  return twimlWithLog(xml, 'conference_join');
}
