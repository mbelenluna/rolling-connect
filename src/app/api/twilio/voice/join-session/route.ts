/**
 * Twilio Voice webhook: Join an existing interpretation session by session code.
 *
 * Flow:
 * 1. Ask caller to enter their 10-digit session code
 * 2. Validate code against Call.phoneSessionCode in DB
 * 3. Route caller into the matching Twilio conference
 *
 * The session code is visible on screen when the interpretation session begins.
 */
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { logVoiceRequest, logVoiceResponse } from '@/lib/twilio-voice-log';

export const dynamic = 'force-dynamic';

const ROUTE_PATH = '/api/twilio/voice/join-session';

function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '');
}

function getRouteUrl(): string {
  return `${getBaseUrl()}${ROUTE_PATH}`;
}

function twiml(xml: string) {
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

function twimlWithLog(xml: string, branch: string): NextResponse {
  console.log('[twilio/join-session] EXACT_TWIML_RETURNED', { branch, fullXml: xml });
  return twiml(xml);
}

function sayAndHangup(message: string, branch: string): NextResponse {
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
    return await handleJoinSession(req);
  } catch (err) {
    console.error('[twilio/join-session] Unhandled error:', err);
    return sayAndHangup('We are sorry, an error occurred. Please try again later. Goodbye.', 'error');
  }
}

async function handleJoinSession(req: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio/join-session] TWILIO_AUTH_TOKEN not set');
    return sayAndHangup('Service is not configured. Please try again later.', 'no_auth');
  }

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const search = req.nextUrl.search ? req.nextUrl.search : '';
  const canonicalUrl = getRouteUrl() + search;

  if (signature) {
    const valid =
      twilio.validateRequest(authToken, signature, canonicalUrl, params) ||
      (req.url?.startsWith('http') && twilio.validateRequest(authToken, signature, req.url, params));
    if (!valid) {
      console.warn('[twilio/join-session] Invalid signature', { canonicalUrl, reqUrl: req.url });
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const step = req.nextUrl.searchParams.get('step');
  const digits = params.Digits ?? '';

  logVoiceRequest('join-session', {
    url: req.url,
    step,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
  });

  if (!step) {
    // Step 1: Ask for the 10-digit session code
    const actionUrl = escapeXml(`${getRouteUrl()}?step=validate_code`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="10" action="${actionUrl}" method="POST" timeout="20" input="dtmf"><Say voice="alice" language="en-US">Please enter the 10-digit session code shown on screen, followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive a session code. Goodbye.</Say><Hangup/></Response>`;
    logVoiceResponse('join-session', { step: null, branch: 'collect_code' });
    return twimlWithLog(xml, 'collect_code');
  }

  if (step === 'validate_code') {
    const code = digits.replace(/\D/g, '');

    if (!code || code.length !== 10) {
      console.log('[twilio/join-session] invalid_code_length', { step, code });
      logVoiceResponse('join-session', { step, branch: 'invalid_code_length' });
      // Replay the prompt once
      const actionUrl = escapeXml(`${getRouteUrl()}?step=validate_code`);
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather numDigits="10" action="${actionUrl}" method="POST" timeout="20" input="dtmf"><Say voice="alice" language="en-US">That code was not valid. Please enter the 10-digit session code shown on screen.</Say></Gather><Say voice="alice" language="en-US">We did not receive a valid session code. Goodbye.</Say><Hangup/></Response>`;
      return twimlWithLog(xml, 'invalid_code_length');
    }

    const { prisma } = await import('@/lib/prisma');

    // Look up the Call by session code
    const call = await prisma.call.findUnique({
      where: { phoneSessionCode: code },
      include: { job: true },
    });

    if (!call) {
      console.log('[twilio/join-session] code_not_found', { step, code });
      logVoiceResponse('join-session', { step, branch: 'code_not_found' });
      return sayAndHangup(
        'That session code was not found. Please check the code on screen and try again. Goodbye.',
        'code_not_found'
      );
    }

    // Check that the session is still active
    if (call.endedAt) {
      console.log('[twilio/join-session] session_ended', { step, code, callId: call.id });
      logVoiceResponse('join-session', { step, branch: 'session_ended' });
      return sayAndHangup(
        'That session has already ended. Goodbye.',
        'session_ended'
      );
    }

    if (call.job.status === 'completed' || call.job.status === 'canceled' || call.job.status === 'expired') {
      console.log('[twilio/join-session] job_not_active', { step, code, jobStatus: call.job.status });
      logVoiceResponse('join-session', { step, branch: 'job_not_active' });
      return sayAndHangup(
        'That session is no longer active. Goodbye.',
        'job_not_active'
      );
    }

    // Derive the Twilio conference name from the job ID (consistent with phone-request.ts)
    const conferenceName = `rolling-${call.job.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;

    console.log('[twilio/join-session] joining_conference', { step, code, conferenceName, callId: call.id });
    logVoiceResponse('join-session', { step, branch: 'joining_conference' });

    const base = getBaseUrl();
    const statusCallback = escapeXml(`${base}/api/twilio/voice/conference-status`);

    // Join as a guest participant - endConferenceOnExit=false so the session continues if they hang up
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Connecting you to the session now.</Say><Dial><Conference beep="onEnter" startConferenceOnEnter="false" endConferenceOnExit="false" participantLabel="guest-phone" statusCallback="${statusCallback}" statusCallbackEvent="join leave">${escapeXml(conferenceName)}</Conference></Dial></Response>`;
    return twimlWithLog(xml, 'joining_conference');
  }

  logVoiceResponse('join-session', { step, branch: 'fallback_unknown_step' });
  return sayAndHangup('We could not process your request. Goodbye.', 'fallback_unknown_step');
}
