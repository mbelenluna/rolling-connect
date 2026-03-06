/**
 * Create Twilio Voice Access Token for browser client (interpreter joining conference).
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_TWIML_APP_SID
 * Optional: TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET (recommended for production)
 */
import twilio from 'twilio';

export function createTwilioVoiceToken(identity: string, ttlSeconds = 3600): { token: string } | { error: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();

  if (!accountSid || !authToken) {
    return { error: 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required' };
  }
  if (!twimlAppSid) {
    return { error: 'TWILIO_TWIML_APP_SID is required for phone OPI. Create a TwiML App in Twilio Console with Voice URL = /api/twilio/voice/connect-interpreter' };
  }

  const signingKeySid = apiKeySid || accountSid;
  const signingKeySecret = apiKeySecret || authToken;

  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, signingKeySid, signingKeySecret, {
      identity,
      ttl: ttlSeconds,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    });
    token.addGrant(voiceGrant);

    return { token: token.toJwt() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[twilio-token]', e);
    return { error: `Failed to create token: ${msg}` };
  }
}
