# Twilio IVR Runtime Debugging Guide

## 1. Verify Production Deployment

**Check version:**
```
GET https://rolling-connect.com/api/twilio/voice/version
```
Expected: `{ "version": "RC-voice-v2", "ts": "..." }`

**Check greeting:** When you call, the greeting should say "RC voice v2" (e.g. "Welcome to Rolling Connect. RC voice v2. Please enter your 6 digit client ID...").

If you don't hear "RC voice v2", production is serving old code. Redeploy and clear any CDN/cache.

---

## 2. Log Output

All Twilio voice routes log structured JSON to stdout. In Vercel: **Dashboard → Project → Logs** (or Runtime Logs). Filter by `[twilio-voice]` or `version`.

**Request log shape:**
```json
{"ts":"...","version":"RC-voice-v2","route":"incoming","event":"request","url":"...","step":"validate_client","digits":"123456","callSid":"CA...","from":"+1...","to":"+1...","bodyKeys":["CallSid","Digits",...]}
```

**Response log shape:**
```json
{"ts":"...","version":"RC-voice-v2","route":"incoming","event":"response","step":"validate_client","branch":"validate_client_ok_language_menu","twimlPreview":"<?xml...","twimlLength":1234}
```

**Branches:**
- `greeting` — initial call, returned client-ID Gather
- `validate_client_empty_digits` — client ID timeout, returned redirect
- `validate_client_ok_language_menu` — returned language menu TwiML
- `validate_client_ok_debug_menu` — returned debug menu (when TWILIO_DEBUG_LANGUAGE=1)
- `create_request_empty_digits` — language Gather posted with empty Digits (bug)
- `create_request_ok_conference` — language selected, returned conference TwiML

---

## 3. Expected Request Sequence (Successful Call)

| # | Request URL | Body (Digits) | Response branch |
|---|-------------|---------------|-----------------|
| 1 | `/api/twilio/voice/incoming` | (none) | greeting |
| 2 | `/api/twilio/voice/incoming?step=validate_client` | Digits=123456 | validate_client_ok_language_menu |
| 3 | `/api/twilio/voice/incoming?step=create_request&clientId=123456` | Digits=1 | create_request_ok_conference |
| 4 | `/api/twilio/voice/hold-message` | (Twilio params) | hold-message |

**If you see `create_request_empty_digits`** between steps 2 and 3, the language Gather is posting with empty Digits. That indicates either:
- `actionOnEmptyResult` is still present (should be removed)
- Digit carryover from client code (e.g. trailing # or buffered digits)
- Twilio Gather timeout firing before user presses

---

## 4. Debug Mode (Isolate Gather)

Set in Vercel env:
```
TWILIO_DEBUG_LANGUAGE=1
```

Redeploy. After client code entry, you'll get a minimal menu:
- "This is the language test menu. Press 1 now."
- Action: `/api/twilio/voice/debug-language`
- Timeout: 10 seconds

If you hear "No input received" immediately, the Gather itself is failing (Twilio or network). If you hear "You pressed 1" after pressing 1, the Gather works and the bug is in our main IVR logic.

---

## 5. Language Menu TwiML (Expected)

After successful client code, the response should be:
```xml
<Response>
  <Gather numDigits="1" timeout="5" action="https://rolling-connect.com/api/twilio/voice/incoming?step=create_request&clientId=123456" method="POST" input="dtmf">
    <Say voice="alice" language="en-US">Select your language. Press 1 for Spanish. Press 2 for Chinese Mandarin. ...</Say>
  </Gather>
  <Say voice="alice" language="en-US">We did not receive your language selection. Goodbye.</Say>
  <Hangup/>
</Response>
```

Check logs for `twimlPreview` in the `validate_client_ok_language_menu` response. Verify:
- `<Gather>` exists
- `<Say>` is inside `<Gather>`
- No `<Redirect>` before the fallback
- `action` URL is correct
- `timeout="5"`
- `input="dtmf"`

---

## 6. Client Code Carryover

The client ID Gather uses `numDigits="6"` and `finishOnKey="#"`. When the user enters 123456, Twilio POSTs to validate_client with Digits=123456. We return the language menu. The language Gather should start fresh.

**Removed `actionOnEmptyResult`** from the client ID Gather to avoid a second POST with empty Digits on timeout that could confuse the flow.

If digits from the client code (e.g. "1" from "123456") are being passed to the language Gather, we would see a POST to create_request with Digits=1. That would create a Spanish request and play "Connecting..." — not "We did not receive your language selection." So carryover would produce a different symptom.

---

## 7. Root Cause Checklist

- [ ] Version endpoint returns RC-voice-v2
- [ ] Greeting says "RC voice v2"
- [ ] Logs show `validate_client_ok_language_menu` after client code
- [ ] `twimlPreview` contains valid Gather with Say inside
- [ ] No `create_request_empty_digits` before user presses
- [ ] Debug mode (TWILIO_DEBUG_LANGUAGE=1) isolates Gather behavior
