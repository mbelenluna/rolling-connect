import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify Twilio phone IVR configuration.
 * Visit /api/debug/twilio-status to see if env vars are set and webhook URL is correct.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();

  const baseUrl = nextAuthUrl || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');
  const webhookBase = baseUrl.replace(/\/$/, '');
  const voiceWebhookUrl = `${webhookBase}/api/twilio/voice/incoming`;
  const holdMessageUrl = `${webhookBase}/api/twilio/voice/hold-message`;
  const connectInterpreterUrl = `${webhookBase}/api/twilio/voice/connect-interpreter`;

  const config = {
    TWILIO_ACCOUNT_SID: accountSid ? `Set (${accountSid.slice(0, 8)}...)` : 'NOT SET',
    TWILIO_AUTH_TOKEN: authToken ? 'Set' : 'NOT SET',
    TWILIO_TWIML_APP_SID: twimlAppSid ? `Set (${twimlAppSid})` : 'NOT SET',
    NEXTAUTH_URL: nextAuthUrl || 'NOT SET',
    VERCEL_URL: vercelUrl || 'NOT SET',
    effectiveBaseUrl: baseUrl,
    voiceWebhookUrl,
    holdMessageUrl,
    connectInterpreterUrl,
  };

  const issues: string[] = [];

  if (!accountSid) issues.push('TWILIO_ACCOUNT_SID is not set');
  if (!authToken) issues.push('TWILIO_AUTH_TOKEN is not set');
  if (!twimlAppSid) issues.push('TWILIO_TWIML_APP_SID is not set (needed for interpreter to join via browser)');

  if (baseUrl.includes('localhost')) {
    issues.push(
      'Base URL is localhost. Twilio cannot reach localhost. Deploy to Vercel or use ngrok, and set NEXTAUTH_URL to your public URL.'
    );
  }

  if (!nextAuthUrl && !vercelUrl) {
    issues.push('Neither NEXTAUTH_URL nor VERCEL_URL is set. Webhook URL may be wrong.');
  }

  const ok = issues.length === 0;

  return NextResponse.json({
    ok,
    config,
    issues: issues.length ? issues : undefined,
    checklist: [
      '1. Buy a voice-capable US number in Twilio Console → Phone Numbers',
      '2. Set the number\'s Voice webhook to: ' + voiceWebhookUrl,
      '3. Create a TwiML App with Voice URL: ' + connectInterpreterUrl,
      '4. Ensure at least one Organization has a 6-digit phoneClientId in the database',
      '5. Check Twilio Console → Monitor → Logs for incoming call errors',
    ],
    note: 'If calls fail silently, check Twilio Debugger (console.twilio.com → Monitor → Logs) for webhook errors, timeouts, or 403 (signature validation).',
  });
}
