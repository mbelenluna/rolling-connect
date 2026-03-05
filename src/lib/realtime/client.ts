/**
 * Client-side Ably Realtime setup for browser.
 * Uses token auth via /api/realtime/auth - no API key exposed.
 */

import Ably from 'ably';

const AUTH_URL = '/api/realtime/auth';

export type RequestStatusPayload = {
  status: string;
  timestamp: number;
  requestId?: string;
};

/**
 * Create Ably Realtime client with token auth.
 * Pass channelNames to request subscribe capability for those channels.
 */
export function createAblyClient(channelNames: string[]): Ably.Realtime {
  return new Ably.Realtime({
    authUrl: AUTH_URL,
    authMethod: 'POST',
    authParams: { channels: channelNames.join(',') },
  });
}

/**
 * Subscribe to request:{requestId} and call onStatus when request_status received.
 * Client must re-fetch from GET /api/requests/[id] - never trust event payload alone.
 */
export function subscribeToRequest(
  requestId: string,
  onStatus: (payload: RequestStatusPayload) => void
): () => void {
  const channelName = `request:${requestId}`;
  const client = createAblyClient([channelName]);

  const channel = client.channels.get(channelName);
  channel.subscribe('request_status', (msg) => {
    const data = msg.data as RequestStatusPayload;
    if (data) onStatus(data);
  });

  return () => {
    channel.unsubscribe('request_status');
    client.close();
  };
}
