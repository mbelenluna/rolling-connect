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
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

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
    // Initial call: present main menu - Press 1 to request interpretation, Press 2 to join existing session
    const actionUrl = escapeXml(`${getWebhookBaseUrl()}?step=route_choice`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="1" action="${actionUrl}" method="POST" timeout="10" input="dtmf"><Say voice="alice" language="en-US">Thank you for calling Rolling Connect. Press 1 to request interpretation now. Press 2 to join an existing session with a session code.</Say></Gather><Say voice="alice" language="en-US">We did not receive your selection. Goodbye.</Say><Hangup/></Response>`;
    logVoiceResponse('incoming', { step: null, branch: 'main_menu', twimlPreview: xml, twimlLength: xml.length });
    return twimlWithLog(xml, 'main_menu');
  }

  if (step === 'route_choice') {
    const choice = digits.trim();
    if (choice === '1') {
      // Request interpretation: collect client ID
      const collectUrl = escapeXml(`${getWebhookBaseUrl()}?step=collect_client`);
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${collectUrl}</Redirect></Response>`;
      console.log('[twilio/incoming] route_choice', { step, branch: 'route_to_request', choice });
      logVoiceResponse('incoming', { step, branch: 'route_to_request' });
      return twimlWithLog(xml, 'route_to_request');
    }
    if (choice === '2') {
      // Join existing session: redirect to join-session route
      const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const joinUrl = escapeXml(`${base.replace(/\/$/, '')}/api/twilio/voice/join-session`);
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${joinUrl}</Redirect></Response>`;
      console.log('[twilio/incoming] route_choice', { step, branch: 'route_to_join_session', choice });
      logVoiceResponse('incoming', { step, branch: 'route_to_join_session' });
      return twimlWithLog(xml, 'route_to_join_session');
    }
    // Invalid choice: replay menu
    const baseUrl = escapeXml(getWebhookBaseUrl());
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Invalid selection. Please try again.</Say><Redirect method="POST">${baseUrl}</Redirect></Response>`;
    console.log('[twilio/incoming] route_choice_invalid', { step, choice });
    logVoiceResponse('incoming', { step, branch: 'route_choice_invalid' });
    return twimlWithLog(xml, 'route_choice_invalid');
  }

  if (step === 'collect_client') {
    // Collect 6-digit client ID (same logic as original greeting)
    const actionUrl = escapeXml(`${getWebhookBaseUrl()}?step=validate_client`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="6" finishOnKey="#" action="${actionUrl}" method="POST" timeout="15" input="dtmf"><Say voice="alice" language="en-US">Please enter your six-digit client code followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive your client ID. Goodbye.</Say><Hangup/></Response>`;
    logVoiceResponse('incoming', { step, branch: 'collect_client', twimlPreview: xml });
    return twimlWithLog(xml, 'collect_client');
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
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Thank you.</Say><Pause length="1"/><Redirect method="POST">${menuUrl}</Redirect></Response>`;
    logVoiceResponse('incoming', { step, branch: 'validate_client_redirect_to_menu', twimlPreview: xml });
    return twimlWithLog(xml, 'validate_client_redirect_to_menu');
  }

  logVoiceResponse('incoming', { step, branch: 'fallback_unknown_step' });
  return sayAndHangup('We could not process your request. Goodbye.', 'fallback_unknown_step');
}
