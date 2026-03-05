/**
 * Ably token auth endpoint.
 * Validates NextAuth session and grants subscribe permission only to channels
 * for requests owned by the user (client) or assigned to the user (interpreter).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Ably from 'ably';

export const dynamic = 'force-dynamic';

const CHANNEL_PREFIX = 'request:';

function parseChannels(param: string | null): string[] {
  if (!param?.trim()) return [];
  return param.split(',').map((c) => c.trim()).filter(Boolean);
}

function isValidRequestChannel(name: string): boolean {
  return name.startsWith(CHANNEL_PREFIX) && name.length > CHANNEL_PREFIX.length;
}

export async function GET(req: Request) {
  return handleAuth(req);
}

export async function POST(req: Request) {
  return handleAuth(req);
}

async function handleAuth(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let channelsParam = searchParams.get('channels');
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      channelsParam = channelsParam || body?.channels;
    } catch {
      // ignore
    }
  }

  const requestedChannels = parseChannels(channelsParam);
  if (requestedChannels.length === 0) {
    return NextResponse.json({ error: 'No channels specified' }, { status: 400 });
  }

  const allowedChannels: string[] = [];
  for (const ch of requestedChannels) {
    if (!isValidRequestChannel(ch)) continue;
    const requestId = ch.slice(CHANNEL_PREFIX.length);

    const request = await prisma.interpretationRequest.findFirst({
      where: { id: requestId },
      include: {
        jobs: {
          where: { assignedInterpreterId: { not: null } },
          select: { assignedInterpreterId: true },
        },
      },
    });
    if (!request) continue;

    const isOwner = request.createdByUserId === userId;
    const isAssignedInterpreter = request.jobs.some(
      (j) => j.assignedInterpreterId === userId
    );
    const isAdmin = role === 'admin';

    if (isOwner || isAssignedInterpreter || isAdmin) {
      allowedChannels.push(ch);
    }
  }

  if (allowedChannels.length === 0) {
    return NextResponse.json({ error: 'No allowed channels' }, { status: 403 });
  }

  const key = process.env.ABLY_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { error: 'Realtime not configured' },
      { status: 503 }
    );
  }

  const capability: Record<string, string[]> = {};
  for (const ch of allowedChannels) {
    capability[ch] = ['subscribe'];
  }

  try {
    const rest = new Ably.Rest({ key });
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: userId,
      capability,
      ttl: 60 * 60 * 1000,
    });
    return NextResponse.json(tokenRequest);
  } catch (err) {
    console.error('[realtime] auth createTokenRequest failed:', err);
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    );
  }
}
