/**
 * Create Twilio Voice Access Token for browser client (interpreter joining conference).
 *
 * IMPORTANT: Access Tokens must be signed with an API Key, NOT the Auth Token.
 * Auth Token cannot be used for JWT signing — it produces AccessTokenInvalid (20101).
 *
 * Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_TWIML_APP_SID
 */
import twilio from 'twilio';

export function createTwilioVoiceToken(identity: string, ttlSeconds = 3600): { token: string } | { error: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim();
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim();

  if (!accountSid) {
    return { error: 'TWILIO_ACCOUNT_SID is required' };
  }
  if (!twimlAppSid) {
    const base = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const voiceUrl = `${base.replace(/\/$/, '')}/api/twilio/voice/connect-interpreter`;
    return {
      error: `TWILIO_TWIML_APP_SID is required. Create a TwiML App at console.twilio.com → Voice → TwiML Apps. Set Voice URL to: ${voiceUrl}`,
    };
  }
  if (!apiKeySid || !apiKeySecret) {
    return {
      error:
        'TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are required for interpreter tokens. Create an API Key at console.twilio.com → Account → API keys & tokens. Do NOT use Auth Token — it cannot sign Access Tokens.',
    };
  }

  try {
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: ttlSeconds,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: false,
    });
    token.addGrant(voiceGrant);

    const jwt = token.toJwt();

    // Safe logging: no secrets, no full JWT
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    console.log('[twilio-token] generated', {
      identity,
      accountSidPrefix: accountSid.slice(0, 6),
      apiKeySidPrefix: apiKeySid.slice(0, 6),
      twimlAppSid,
      ttlSeconds,
      expTimestamp: exp,
      tokenLength: jwt.length,
    });

    return { token: jwt };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[twilio-token]', e);
    return { error: `Failed to create token: ${msg}` };
  }
}
