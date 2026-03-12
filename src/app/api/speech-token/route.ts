import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';
const { create: createToken } = require('../../../lib/speech-token-store');

export const dynamic = 'force-dynamic';

/**
 * GET /api/speech-token
 * Returns a short-lived token for the speech WebSocket (host, auth required).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const token = crypto.randomBytes(32).toString('hex');
  createToken(token, { role: 'host' });

  return NextResponse.json({ token });
}
