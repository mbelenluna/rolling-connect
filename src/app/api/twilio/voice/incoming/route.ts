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

function buildLanguageMenu(): string {
  const lines = Object.entries(IVR_LANGUAGE_MAP)
    .filter(([_, v]) => v.target !== 'en')
    .map(([digit, v]) => `Press ${digit} for ${v.target === 'es' ? 'Spanish' : v.target === 'zh' ? 'Chinese' : v.target}.`)
    .join(' ');
  return `Select your language. ${lines} Press 8 for other.`;
}

export async function POST(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio/voice] TWILIO_AUTH_TOKEN not set');
    return sayAndHangup('Service is not configured. Please try again later.');
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  // Use actual request URL for signature validation (avoids www vs non-www mismatch)
  const fullUrl =
    req.url && req.url.startsWith('http')
      ? req.url
      : getWebhookBaseUrl() + (req.nextUrl.search ? req.nextUrl.search : '');

  if (signature && !twilio.validateRequest(authToken, signature, fullUrl, params)) {
    console.warn('[twilio/voice] Invalid signature');
    return new NextResponse('Forbidden', { status: 403 });
  }

  const step = req.nextUrl.searchParams.get('step');
  const clientIdParam = req.nextUrl.searchParams.get('clientId');
  const digits = params.Digits ?? '';

  if (!step) {
    // Initial call: greet and collect client ID
    const actionUrl = `${getWebhookBaseUrl()}?step=validate_client`;
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Welcome to Rolling Connect. Please enter your 6 digit client ID, followed by the pound key.</Say><Gather numDigits="6" finishOnKey="#" action="${actionUrl}" method="POST" timeout="10"/><Say voice="alice" language="en-US">We did not receive your client ID. Goodbye.</Say><Hangup/></Response>`
    );
  }

  if (step === 'validate_client') {
    const clientId = digits.replace(/\D/g, '');
    if (!clientId || clientId.length !== 6) {
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.');
    }

    const { prisma } = await import('@/lib/prisma');
    const org = await prisma.organization.findFirst({
      where: { phoneClientId: clientId },
    });
    if (!org) {
      return sayAndHangup('Invalid client ID. Please check your number and try again. Goodbye.');
    }

    const actionUrl = `${getWebhookBaseUrl()}?step=create_request&clientId=${encodeURIComponent(clientId)}`;
    const langMenu = buildLanguageMenu();
    return twiml(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">${escapeXml(langMenu)}</Say><Gather numDigits="1" finishOnKey="#" action="${actionUrl}" method="POST" timeout="10"/><Say voice="alice" language="en-US">We did not receive your selection. Goodbye.</Say><Hangup/></Response>`
    );
  }

  if (step === 'create_request' && clientIdParam) {
    const digit = digits.trim() || '8';
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
