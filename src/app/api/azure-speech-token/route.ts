import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/azure-speech-token
 * Returns an Azure Speech auth token for the client to use with the Speech SDK.
 * Token is valid for ~10 minutes.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!key || !region) {
    return NextResponse.json(
      { error: 'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set in .env' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Azure token failed: ${res.status} - ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const token = await res.text();
    return NextResponse.json({ token, region });
  } catch (e) {
    console.error('Azure speech token error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to get token' },
      { status: 500 }
    );
  }
}
