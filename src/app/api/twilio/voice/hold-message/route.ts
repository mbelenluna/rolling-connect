/**
 * TwiML for conference waitUrl: plays hold message while caller waits for interpreter.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const holdUrl = `${base.replace(/\/$/, '')}/api/twilio/voice/hold-message`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">Please hold while we connect you to an interpreter. Your call is important to us.</Say>
  <Pause length="5"/>
  <Redirect>${holdUrl}</Redirect>
</Response>`;
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
