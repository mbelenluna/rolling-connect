# Twilio Phone IVR Troubleshooting

If calling your Twilio number doesn't work (no answer, immediate hangup, or errors), follow this guide.

## Quick Diagnostics

1. **Check the diagnostic endpoint** (when your app is deployed):
   ```
   GET https://YOUR-DOMAIN.com/api/debug/twilio-status
   ```
   This shows whether env vars are set and what webhook URL Twilio should use.

2. **Check Twilio Console** → [Monitor → Logs](https://console.twilio.com/us1/monitor/logs):
   - Do you see any incoming call attempts?
   - If yes: check the webhook response (200, 403, 500, timeout).
   - If no: the call may not be reaching Twilio (number misconfigured or wrong number).

---

## Common Issues

### 1. Calls Don't Connect / No Answer

**Possible causes:**
- **Wrong number displayed**: The number shown in the app (e.g. +1 689 400 7175) may be a placeholder. You must buy and configure your own Twilio number.
- **Number not configured**: In [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming), select your number and ensure:
  - **Voice & Fax** → A CALL COMES IN: Webhook, `https://YOUR-DOMAIN.com/api/twilio/voice/incoming`, HTTP POST
- **Localhost**: If `NEXTAUTH_URL` or `VERCEL_URL` points to `localhost`, Twilio cannot reach your webhook. Deploy to Vercel (or similar) and set `NEXTAUTH_URL` to your public URL.

### 2. Call Connects but Immediately Hangs Up

**Possible causes:**
- **403 Forbidden**: Signature validation failed. The URL Twilio uses must exactly match what your app expects. Ensure:
  - Twilio number's Voice webhook URL matches `NEXTAUTH_URL` + `/api/twilio/voice/incoming`
  - No `www` vs non-`www` mismatch (e.g. both use `https://rolling-connect.com` or both use `https://www.rolling-connect.com`)
- **Invalid Client ID**: The IVR asks for a 6-digit Client ID. If no organization has that `phoneClientId` in the database, the call says "Invalid client ID" and hangs up. Add a `phoneClientId` to an organization in the admin panel.

### 3. "Service is not configured"

- `TWILIO_AUTH_TOKEN` is not set. Add it to your environment variables and redeploy.

### 4. Interpreter Can't Join the Call / AccessTokenInvalid (20101)

- **API Key required**: Access Tokens must be signed with an API Key, NOT the Auth Token. Set:
  - `TWILIO_API_KEY_SID` — Create at [Twilio Console → Account → API keys](https://console.twilio.com/us1/account/keys-credentials/api-keys)
  - `TWILIO_API_KEY_SECRET` — Shown once when creating the key. Do NOT use `TWILIO_AUTH_TOKEN` here.
- `TWILIO_TWIML_APP_SID` must be set. Create a [TwiML App](https://console.twilio.com/us1/develop/voice/manage/twiml-apps) with:
  - Voice URL: `https://YOUR-DOMAIN.com/api/twilio/voice/connect-interpreter`
  - Voice Method: HTTP POST
- **Debug**: Visit `GET /api/debug/twilio-token` (while logged in as interpreter) to verify token generation.

---

## Checklist

- [ ] Bought a voice-capable US number in Twilio
- [ ] Set the number's Voice webhook to `https://YOUR-DOMAIN.com/api/twilio/voice/incoming`
- [ ] Created TwiML App with Voice URL `https://YOUR-DOMAIN.com/api/twilio/voice/connect-interpreter`
- [ ] Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_TWIML_APP_SID` in env
- [ ] Set `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` (required for interpreter browser tokens)
- [ ] Set `NEXTAUTH_URL` to your public URL (not localhost)
- [ ] At least one Organization has a 6-digit `phoneClientId` in the database
- [ ] Updated the phone number displayed in the app to match your Twilio number

---

## Twilio Debugger

Use [Twilio Debugger](https://console.twilio.com/us1/monitor/logs/debugger) to see:
- Webhook request/response
- Error codes (11200 = connection timeout, 11205 = connection refused, etc.)
- Whether the request reached your server
