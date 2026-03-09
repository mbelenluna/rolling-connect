/**
 * DEBUG ONLY: Minimal language Gather to isolate whether Twilio Gather works.
 * Remove or disable after debugging.
 *
 * Expected flow: Twilio POSTs here when user presses a digit in the test Gather.
 * If we receive Digits=1, say "You pressed 1". Otherwise "Invalid input".
 */
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const digits = params.Digits ?? '';

  console.log('[twilio/debug-language] REQUEST_BODY', { fullBody: body, digits: JSON.stringify(digits), params: JSON.stringify(params) });

  logVoiceRequest('debug-language', {
    url: req.url,
    digits,
    callSid: params.CallSid,
    from: params.From,
    to: params.To,
    bodyKeys: Object.keys(params),
  });

  let msg: string;
  if (digits === '1') {
    msg = 'You pressed 1.';
  } else if (!digits || digits.trim() === '') {
    msg = 'No digits received.';
  } else {
    msg = 'Invalid input.';
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice" language="en-US">${escapeXml(msg)}</Say><Hangup/></Response>`;

  console.log('[twilio/debug-language] EXACT_TWIML_RETURNED', { fullXml: xml });
  logVoiceResponse('debug-language', { branch: digits ? 'digit_received' : 'no_digit', twimlPreview: xml });
  return twiml(xml);
}
