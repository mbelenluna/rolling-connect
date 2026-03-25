/**
 * Twilio Voice webhook: Join an existing interpretation session by session code.
 *
 * Flow:
 * 1. Ask caller to enter their session code followed by #
 * 2. Validate code against Call.phoneSessionCode in DB
 * 3a. Phone-originated session (roomId starts with "rolling-"): join the Twilio conference
 * 3b. Web-originated session (Daily.co): bridge via Daily.co SIP
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

/** Prompt to collect session code. retry=true plays an "invalid code" prefix. */
function collectCodeResponse(retry = false): NextResponse {
  const actionUrl = escapeXml(`${getRouteUrl()}?step=validate_code`);
  const intro = retry
    ? 'That code was not recognised. Please try again. '
    : '';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather finishOnKey="#" action="${actionUrl}" method="POST" timeout="20" input="dtmf"><Say voice="alice" language="en-US">${intro}Please enter your session code followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive a session code. Goodbye.</Say><Hangup/></Response>`;
  return twimlWithLog(xml, retry ? 'collect_code_retry' : 'collect_code');
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
  // Strip trailing # that finishOnKey="#" appends before digits
  const digits = (params.Digits ?? '').replace(/#$/, '').replace(/\D/g, '');
  const attempt = parseInt(req.nextUrl.searchParams.get('attempt') ?? '1', 10);

  logVoiceRequest('join-session', {
    url: req.url,
    step,
    digits,
    attempt,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
  });

  // ── Step 1: collect code ──────────────────────────────────────────────────
  if (!step) {
    logVoiceResponse('join-session', { step: null, branch: 'collect_code' });
    return collectCodeResponse(false);
  }

  // ── Step 2: validate code ─────────────────────────────────────────────────
  if (step === 'validate_code') {
    const code = digits;

    // Must be exactly 10 digits
    if (!code || code.length !== 10) {
      console.log('[twilio/join-session] invalid_code_length', { step, code, attempt });
      logVoiceResponse('join-session', { step, branch: 'invalid_code_length' });
      if (attempt < 3) {
        // Retry — redirect with incremented attempt counter
        const retryUrl = escapeXml(`${getRouteUrl()}?step=validate_code&attempt=${attempt + 1}`);
        const intro = 'That code was not valid, it must be 10 digits. Please try again. ';
        const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather finishOnKey="#" action="${retryUrl}" method="POST" timeout="20" input="dtmf"><Say voice="alice" language="en-US">${intro}Please enter your session code followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive a valid session code. Goodbye.</Say><Hangup/></Response>`;
        return twimlWithLog(xml, 'invalid_code_length_retry');
      }
      return sayAndHangup('We could not verify your session code. Please check the code and call again. Goodbye.', 'invalid_code_max_attempts');
    }

    const { prisma } = await import('@/lib/prisma');

    // Look up the Call by session code
    const call = await prisma.call.findUnique({
      where: { phoneSessionCode: code },
      include: { job: true },
    });

    // Code not found — allow retries
    if (!call) {
      console.log('[twilio/join-session] code_not_found', { step, code, attempt });
      logVoiceResponse('join-session', { step, branch: 'code_not_found' });
      if (attempt < 3) {
        const retryUrl = escapeXml(`${getRouteUrl()}?step=validate_code&attempt=${attempt + 1}`);
        const intro = 'That session code was not found. Please double-check the code on screen and try again. ';
        const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Gather finishOnKey="#" action="${retryUrl}" method="POST" timeout="20" input="dtmf"><Say voice="alice" language="en-US">${intro}Please enter your session code followed by the pound key.</Say></Gather><Say voice="alice" language="en-US">We did not receive a session code. Goodbye.</Say><Hangup/></Response>`;
        return twimlWithLog(xml, 'code_not_found_retry');
      }
      return sayAndHangup('That session code was not found. Please check the code and call again. Goodbye.', 'code_not_found_max_attempts');
    }

    // Session already ended
    if (call.endedAt) {
      console.log('[twilio/join-session] session_ended', { step, code, callId: call.id });
      logVoiceResponse('join-session', { step, branch: 'session_ended' });
      return sayAndHangup('That session has already ended. Goodbye.', 'session_ended');
    }

    if (call.job.status === 'completed' || call.job.status === 'canceled' || call.job.status === 'expired') {
      console.log('[twilio/join-session] job_not_active', { step, code, jobStatus: call.job.status });
      logVoiceResponse('join-session', { step, branch: 'job_not_active' });
      return sayAndHangup('That session is no longer active. Goodbye.', 'job_not_active');
    }

    const roomId = call.roomId;
    const isPhoneOriginated = roomId.startsWith('rolling-');

    console.log('[twilio/join-session] session_found', {
      step, code, callId: call.id, roomId, isPhoneOriginated,
    });

    // ── 3a: Phone-originated — join the Twilio conference ──────────────────
    if (isPhoneOriginated) {
      // roomId IS the conference name (e.g. "rolling-abc-123")
      const conferenceName = roomId;
      const statusCallback = escapeXml(`${getBaseUrl()}/api/twilio/voice/conference-status`);

      logVoiceResponse('join-session', { step, branch: 'joining_conference', conferenceName });
      console.log('[twilio/join-session] joining_conference', { conferenceName, callId: call.id });

      // startConferenceOnEnter="true" so the guest can join even if the original
      // caller dropped and the conference is temporarily empty.
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Connecting you to the session now. Please hold.</Say><Dial><Conference beep="onEnter" startConferenceOnEnter="true" endConferenceOnExit="false" participantLabel="guest-phone" statusCallback="${statusCallback}" statusCallbackEvent="join leave">${escapeXml(conferenceName)}</Conference></Dial></Response>`;
      return twimlWithLog(xml, 'joining_conference');
    }

    // ── 3b: Web-originated (Daily.co) — bridge via Daily.co SIP ───────────
    // Daily.co SIP URI: sip:<meeting-token>@sip.daily.co
    // The meeting token encodes which room to join and acts as authentication.
    const roomName = `rolling-${roomId.replace(/[^a-zA-Z0-9-]/g, '-')}`;

    const { createDailyMeetingToken } = await import('@/lib/daily');
    const tokenResult = await createDailyMeetingToken({
      roomName,
      userName: 'Phone Guest',
      userId: `phone-guest-${params.CallSid ?? Date.now()}`,
      serviceType: 'OPI',
    });

    if ('error' in tokenResult) {
      console.error('[twilio/join-session] daily_token_error', { roomName, error: tokenResult.error });
      logVoiceResponse('join-session', { step, branch: 'daily_token_error' });
      return sayAndHangup(
        'We were unable to connect you to the session. Please try again or contact the session host. Goodbye.',
        'daily_token_error'
      );
    }

    const sipUri = `sip:${encodeURIComponent(tokenResult.token)}@sip.daily.co`;
    logVoiceResponse('join-session', { step, branch: 'joining_daily_sip', roomName });
    console.log('[twilio/join-session] joining_daily_sip', { roomName, callId: call.id });

    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">Connecting you to the session now. Please hold.</Say><Dial><Sip>${escapeXml(sipUri)}</Sip></Dial></Response>`;
    return twimlWithLog(xml, 'joining_daily_sip');
  }

  logVoiceResponse('join-session', { step, branch: 'fallback_unknown_step' });
  return sayAndHangup('We could not process your request. Goodbye.', 'fallback_unknown_step');
}
