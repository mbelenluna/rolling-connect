/**
 * Server-side realtime publishing via Ably.
 * Used in API routes after DB updates. No persistent connection required.
 */

import Ably from 'ably';

const CHANNEL_PREFIX = 'request:';

function getAblyRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key?.trim()) return null;
  return new Ably.Rest({ key });
}

export type RequestStatusPayload = {
  status: string;
  timestamp: number;
  requestId?: string;
};

/**
 * Publish request_status event to channel request:{requestId}.
 * Call after DB update. Safe to call even if Ably is not configured.
 */
export async function publishRequestStatus(
  requestId: string,
  payload: RequestStatusPayload
): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;

  const channelName = `${CHANNEL_PREFIX}${requestId}`;
  try {
    const channel = rest.channels.get(channelName);
    await channel.publish('request_status', {
      ...payload,
      requestId,
      timestamp: payload.timestamp || Date.now(),
    });
  } catch (err) {
    console.error('[realtime] publishRequestStatus failed:', err);
  }
}
