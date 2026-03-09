/**
 * Twilio Voice webhook: IVR for phone-based interpretation requests.
 *
 * Flow:
 * 1. Incoming call → greet, collect client ID (6–8 digits)
 * 2. Validate client ID → if invalid, say error and hang up
 * 3. Collect language (1–8)
 * 4. Create request, say result
 *
 * Configure in Twilio Console: Voice webhook URL = https://YOURDOMAIN.com/api/twilio/voice/incoming
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createPhoneRequest, IVR_LANGUAGE_MAP } from '@/lib/phone-request';
import { getIvrVersion, logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

const WEBHOOK_PATH = '/api/twilio/voice/incoming';

function getWebhookBaseUrl(): string {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return base.replace(/\/$/, '') + WEBHOOK_PATH;
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

/** Log exact TwiML Twilio receives, then return. Use for every response. */
function twimlWithLog(xml: string, branch: string): NextResponse {
  console.log('[twilio/incoming] EXACT_TWIML_RETURNED', { branch, fullXml: xml });
  return twiml(xml);
}

function sayAndHangup(message: string, branch: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">${escapeXml(message)}</Say><Hangup/></Response>`;
  return twimlWithLog(xml, branch);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build language menu text (short prompt, single digits 1-9 and 0). Say is nested inside Gather so user can interrupt. */
function buildLanguageMenu(): string {
  const lines = Object.entries(IVR_LANGUAGE_MAP)
    .map(([digit, v]) => `Press ${digit} for ${v.spokenName}.`)
    .join(' ');
  return `Select your language. ${lines}`;
}

export async function POST(req: NextRequest) {
  try {
    return await handleIncoming(req);
  } catch (err) {
    console.error('[twilio/voice] Unhandled error:', err);
    return sayAndHangup('We are sorry, an error occurred. Please try again later. Goodbye.', 'error');
  }
}

async function handleIncoming(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio/voice] TWILIO_AUTH_TOKEN not set');
    return sayAndHangup('Service is not configured. Please try again later.', 'no_auth');
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const search = req.nextUrl.search ? req.nextUrl.search : '';
  const canonicalUrl = getWebhookBaseUrl() + search;

  if (signature) {
    const valid =
      twilio.validateRequest(authToken, signature, canonicalUrl, params) ||
      (req.url?.startsWith('http') && twilio.validateRequest(authToken, signature, req.url, params));
    if (!valid) {
      console.warn('[twilio/voice] Invalid signature', { canonicalUrl, reqUrl: req.url });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const step = req.nextUrl.searchParams.get('step');
  const clientIdParam = req.nextUrl.searchParams.get('clientId');
  const digits = params.Digits ?? '';

  logVoiceRequest('incoming', {
    url: req.url,
    step,
    clientId: clientIdParam,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
    bodyKeys: Object.keys(params),
  });

  if (!step) {
    // Initial call: greet and collect client ID (Say inside Gather, no actionOnEmptyResult to avoid carryover)
    const version = getIvrVersion();
    const actionUrl = escapeXml(`${getWebhookBaseUrl()}?step=validate_client`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="6" finishOnKey="#" action="${actionUrl}" method="POST" timeout="15" input="dtmf"><Say voice="alice" language="en-US">Welcome to Rolling Connect. ${version}. Please enter your 6 digit client ID, followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive your client ID. Goodbye.</Say><Hangup/></Response>`;
    logVoiceResponse('incoming', { step: null, branch: 'greeting', twimlPreview: xml, twimlLength: xml.length });
    return twimlWithLog(xml, 'greeting');
  }

  if (step === 'validate_client') {
    const clientId = digits.replace(/\D/g, '');
    if (!clientId) {
      logVoiceResponse('incoming', { step, branch: 'validate_client_empty_digits' });
      const baseUrl = escapeXml(getWebhookBaseUrl());
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">We did not receive your client ID. Please try again.</Say><Redirect method="POST">${baseUrl}</Redirect></Response>`;
      return twimlWithLog(xml, 'validate_client_empty_digits');
    }
    if (clientId.length !== 6) {
      logVoiceResponse('incoming', { step, branch: 'validate_client_bad_length' });
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.', 'validate_client_bad_length');
    }

    const { prisma } = await import('@/lib/prisma');
    const org = await prisma.organization.findFirst({
      where: { phoneClientId: clientId },
    });
    if (!org) {
      logVoiceResponse('incoming', { step, branch: 'validate_client_org_not_found' });
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.', 'validate_client_org_not_found');
    }

    // Redirect-based separation: Say + Pause + Redirect to avoid DTMF carryover from client-code Gather.
    // Client-code Gather uses finishOnKey="#" so # submits; redirect ensures language Gather starts cleanly.
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const base = baseUrl.replace(/\/$/, '');
    const menuUrl = escapeXml(`${base}/api/twilio/voice/language-menu?clientId=${encodeURIComponent(clientId)}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Client code accepted.</Say><Pause length="1"/><Redirect method="POST">${menuUrl}</Redirect></Response>`;
    logVoiceResponse('incoming', { step, branch: 'validate_client_redirect_to_menu', twimlPreview: xml });
    return twimlWithLog(xml, 'validate_client_redirect_to_menu');
  }

  if (step === 'create_request' && clientIdParam) {
    const digit = digits.trim().replace(/\D/g, '');
    if (!digit) {
      logVoiceResponse('incoming', { step, branch: 'create_request_empty_digits', digits });
      return sayAndHangup('We did not receive your language selection. Goodbye.', 'create_request_empty_digits');
    }
    const result = await createPhoneRequest(clientIdParam, digit);

    if (!result.ok) {
      logVoiceResponse('incoming', { step, branch: `create_request_error_${result.error}` });
      if (result.error === 'INVALID_CLIENT_ID') {
        return sayAndHangup('Invalid client ID. Goodbye.', 'create_request_invalid_client');
      }
      if (result.error === 'ORG_NOT_APPROVED' || result.error === 'NO_OWNER') {
        return sayAndHangup('Your account is not set up for phone requests. Please contact your administrator. Goodbye.', 'create_request_org_not_approved');
      }
      return sayAndHangup('Invalid language selection. Goodbye.', 'create_request_invalid_language');
    }

    if (result.interpretersMatched === 0) {
      logVoiceResponse('incoming', { step, branch: 'create_request_no_interpreters' });
      return sayAndHangup(
        'Your interpretation request has been received. Unfortunately, no interpreters are available at this time. Please try again later or use our website. Goodbye.',
        'create_request_no_interpreters'
      );
    }

    logVoiceResponse('incoming', { step, branch: 'create_request_ok_conference' });
    // Connecting message first, then conference with hold music (waitUrl only used after caller joins conference)
    const conferenceName = `rolling-${result.jobId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const base = baseUrl.replace(/\/$/, '');
    const waitUrl = `${base}/api/twilio/voice/hold-message`;
    const statusCallback = `${base}/api/twilio/voice/conference-status`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Connecting to an available interpreter. Please hold.</Say><Dial><Conference beep="onEnter" startConferenceOnEnter="true" endConferenceOnExit="true" participantLabel="caller" waitUrl="${escapeXml(waitUrl)}" waitMethod="POST" statusCallback="${escapeXml(statusCallback)}" statusCallbackEvent="join leave">${escapeXml(conferenceName)}</Conference></Dial></Response>`;
    return twimlWithLog(xml, 'create_request_ok_conference');
  }

  logVoiceResponse('incoming', { step, branch: 'fallback_unknown_step' });
  return sayAndHangup('We could not process your request. Goodbye.', 'fallback_unknown_step');
}
