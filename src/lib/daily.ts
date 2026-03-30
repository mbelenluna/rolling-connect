/**
 * Daily.co integration for OPI/VRI calls.
 * Set DAILY_API_KEY and DAILY_DOMAIN in .env to enable real video/audio.
 * Get your key at https://dashboard.daily.co
 * DAILY_DOMAIN = your Daily subdomain only (e.g. "mycompany" for mycompany.daily.co)
 */

const DAILY_API = 'https://api.daily.co/v1';

export type DailyTokenResult = { token: string } | { error: string };

/** Create a room first - required for "meeting doesn't exist" fix. Room name: alphanumeric, dash, underscore only. */
async function ensureRoomExists(roomName: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'No API key' };

  try {
    const res = await fetch(`${DAILY_API}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
          start_audio_off: true,
          start_video_off: true,
          enable_video_processing_upgrade: true,
        },
      }),
    });

    const text = await res.text();
    if (res.status === 409) return { ok: true }; // Room already exists
    if (!res.ok) {
      const lower = text.toLowerCase();
      if (lower.includes('already exists') || lower.includes('room already exists')) {
        return { ok: true }; // Room exists, we can proceed
      }
      let detail = '';
      try {
        const body = JSON.parse(text);
        detail = body.info ? ` — ${body.info}` : body.error ? ` — ${body.error}` : text ? ` — ${text.slice(0, 200)}` : '';
      } catch {
        detail = text ? ` — ${text.slice(0, 200)}` : '';
      }
      console.error('Daily create room error:', res.status, text);
      return { ok: false, error: `Create room failed: ${res.status}${detail}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown' };
  }
}

export async function createDailyMeetingToken(params: {
  roomName: string;
  userName: string;
  userId: string;
  exp?: number;
  serviceType?: 'OPI' | 'VRI';
}): Promise<DailyTokenResult> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) {
    return { error: 'DAILY_API_KEY not set in .env. Restart the server after adding it.' };
  }

  const roomOk = await ensureRoomExists(params.roomName);
  if (!roomOk.ok) {
    return { error: roomOk.error || 'Failed to create room' };
  }

  const exp = params.exp ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 24h default

  try {
    const res = await fetch(`${DAILY_API}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: params.roomName,
          user_name: params.userName,
          user_id: params.userId,
          exp,
          enable_prejoin_ui: false,
          start_video_off: params.serviceType === 'OPI',
          start_audio_off: false,
        },
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('Daily API error:', res.status, text);
      return { error: `Daily API error: ${res.status} - ${text.slice(0, 200)}` };
    }

    const data = JSON.parse(text || '{}');
    const token = data.token;
    if (!token) return { error: 'Daily API did not return a token' };
    return { token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('Daily token error:', e);
    return { error: `Failed to create token: ${msg}` };
  }
}

export function getDailyMeetingUrl(roomName: string, token: string): string {
  const domain = process.env.DAILY_DOMAIN || 'rolling-connect';
  return `https://${domain}.daily.co/${roomName}?t=${token}`;
}

/** Eject specific participants from a Daily room by user_id. */
export async function ejectDailyParticipants(roomName: string, userIds: string[]): Promise<void> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey || userIds.length === 0) return;
  try {
    const res = await fetch(`${DAILY_API}/rooms/${roomName}/eject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ user_ids: userIds }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Daily eject failed:', res.status, text);
    }
  } catch (e) {
    console.error('Daily eject error:', e);
  }
}

/**
 * Delete a Daily room. This disconnects ALL participants (client, interpreter, guests).
 * Use when ending a call to ensure invitees cannot stay in the meeting.
 */
export async function deleteDailyRoom(roomName: string): Promise<void> {
  const apiKey = process.env.DAILY_API_KEY?.trim();
  if (!apiKey) return;
  try {
    const res = await fetch(`${DAILY_API}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      console.error('Daily delete room failed:', res.status, text);
    }
  } catch (e) {
    console.error('Daily delete room error:', e);
  }
}
