import { NextResponse } from 'next/server';
import { verifyInviteToken } from '@/lib/invite-token';
import { z } from 'zod';

const schema = z.object({
  inviteToken: z.string(),
  durationSeconds: z.number().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * POST /api/calls/[id]/guest-leave
 * Guest (invitee) leaves the call. Does NOT end the call for client/interpreter.
 * Only the client or interpreter (via "End Call for Everyone") can end the call.
 * Auth via inviteToken.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => e.message).join('; ') || 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { inviteToken } = parsed.data;

    const verifiedCallId = verifyInviteToken(inviteToken);
    if (!verifiedCallId || verifiedCallId !== id) {
      return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');
    const call = await prisma.call.findFirst({
      where: { id },
    });

    if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Guest leave: do NOT end the call. The guest simply disconnects from Daily.
    // The call continues for client and interpreter. Only client or interpreter
    // (via "End Call for Everyone") can end the call.
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Guest leave error:', e);
    const msg = e instanceof Error ? e.message : 'Failed to leave';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
