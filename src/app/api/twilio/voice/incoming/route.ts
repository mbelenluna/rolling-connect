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

function sayAndHangup(message: string) {
  return twiml(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">${escapeXml(message)}</Say><Hangup/></Response>`
  );
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build language menu text. Say is nested inside Gather so user can interrupt by pressing a digit. */
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
    return sayAndHangup('We are sorry, an error occurred. Please try again later. Goodbye.');
  }
}

async function handleIncoming(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio/voice] TWILIO_AUTH_TOKEN not set');
    return sayAndHangup('Service is not configured. Please try again later.');
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

  if (!step) {
    // Initial call: greet and collect client ID
    const actionUrl = escapeXml(`${getWebhookBaseUrl()}?step=validate_client`);
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Welcome to Rolling Connect. Please enter your 6 digit client ID, followed by the pound key. You have 20 seconds.</Say><Gather numDigits="6" finishOnKey="#" action="${actionUrl}" method="POST" timeout="15" actionOnEmptyResult="true"/><Say voice="alice" language="en-US">We did not receive your client ID. Goodbye.</Say><Hangup/></Response>`
    );
  }

  if (step === 'validate_client') {
    const clientId = digits.replace(/\D/g, '');
    if (!clientId) {
      // Timeout or no digits — give caller another chance
      const baseUrl = escapeXml(getWebhookBaseUrl());
      return twiml(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">We did not receive your client ID. Please try again.</Say><Redirect method="POST">${baseUrl}</Redirect></Response>`
      );
    }
    if (clientId.length !== 6) {
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.');
    }

    const { prisma } = await import('@/lib/prisma');
    const org = await prisma.organization.findFirst({
      where: { phoneClientId: clientId },
    });
    if (!org) {
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.');
    }

    const actionUrl = escapeXml(`${getWebhookBaseUrl()}?step=create_request&clientId=${encodeURIComponent(clientId)}`);
    const langMenu = buildLanguageMenu();
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="2" finishOnKey="#" action="${actionUrl}" method="POST" timeout="15" actionOnEmptyResult="true" input="dtmf"><Say voice="alice" language="en-US">${escapeXml(langMenu)}</Say></Gather><Say voice="alice" language="en-US">We did not receive your selection. Goodbye.</Say><Hangup/></Response>`
    );
  }

  if (step === 'create_request' && clientIdParam) {
    const raw = digits.replace(/\D/g, '');
    const digit = raw.length === 1 ? `0${raw}` : raw || '01';
    const result = await createPhoneRequest(clientIdParam, digit);

    if (!result.ok) {
      if (result.error === 'INVALID_CLIENT_ID') {
        return sayAndHangup('Invalid client ID. Goodbye.');
      }
      if (result.error === 'ORG_NOT_APPROVED' || result.error === 'NO_OWNER') {
        return sayAndHangup('Your account is not set up for phone requests. Please contact your administrator. Goodbye.');
      }
      return sayAndHangup('Invalid language selection. Goodbye.');
    }

    if (result.interpretersMatched === 0) {
      return sayAndHangup(
        'Your interpretation request has been received. Unfortunately, no interpreters are available at this time. Please try again later or use our website. Goodbye.'
      );
    }

    // Put caller in Twilio Conference — they stay on the line and hear interpreter when one joins
    const conferenceName = `rolling-${result.jobId.replace(/[^a-zA-Z0-9-]/g, '-')}`;
    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const base = baseUrl.replace(/\/$/, '');
    const waitUrl = `${base}/api/twilio/voice/hold-message`;
    const statusCallback = `${base}/api/twilio/voice/conference-status`;
    // endConferenceOnExit=true on caller: when client hangs up, conference ends for everyone
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Your request has been received. Please hold while we connect you to an interpreter.</Say><Dial><Conference beep="onEnter" startConferenceOnEnter="true" endConferenceOnExit="true" participantLabel="caller" waitUrl="${escapeXml(waitUrl)}" waitMethod="GET" statusCallback="${escapeXml(statusCallback)}" statusCallbackEvent="participant-join,participant-leave">${escapeXml(conferenceName)}</Conference></Dial></Response>`
    );
  }

  return sayAndHangup('We could not process your request. Goodbye.');
}
