/**
 * Structured logging for Twilio voice webhooks.
 * Use VERCEL_LOG_DRAIN or server logs to inspect runtime behavior.
 */
const IVR_VERSION = 'RC-voice-v2';
const LOG_PREFIX = '[twilio-voice]';

export function getIvrVersion(): string {
  return IVR_VERSION;
}

export function logVoiceRequest(route: string, data: {
  url?: string;
  method?: string;
  step?: string | null;
  clientId?: string | null;
  digits?: string;
  callSid?: string;
  from?: string;
  to?: string;
  bodyKeys?: string[];
}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    version: IVR_VERSION,
    route,
    event: 'request',
    ...data,
  }));
}

export function logVoiceResponse(route: string, data: {
  step?: string | null;
  branch?: string;
  digits?: string;
  twimlPreview?: string;
  twimlLength?: number;
}) {
  const { twimlPreview, ...rest } = data;
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    version: IVR_VERSION,
    route,
    event: 'response',
    ...rest,
    ...(twimlPreview && { twimlPreview: twimlPreview.slice(0, 500) }),
  }));
}
