import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;

  let body: { opiRateCents?: number | null; vriRateCents?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { opiRateCents, vriRateCents } = body;

  // Validate: must be null or a non-negative integer
  for (const [key, val] of [['opiRateCents', opiRateCents], ['vriRateCents', vriRateCents]] as [string, unknown][]) {
    if (val !== undefined && val !== null) {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
        return NextResponse.json({ error: `${key} must be a non-negative integer (cents) or null` }, { status: 400 });
      }
    }
  }

  const profile = await prisma.interpreterProfile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: 'Interpreter profile not found' }, { status: 404 });

  const updated = await prisma.interpreterProfile.update({
    where: { userId },
    data: {
      ...(opiRateCents !== undefined ? { opiRateCents } : {}),
      ...(vriRateCents !== undefined ? { vriRateCents } : {}),
    },
    select: { opiRateCents: true, vriRateCents: true },
  });

  return NextResponse.json({ ok: true, opiRateCents: updated.opiRateCents, vriRateCents: updated.vriRateCents });
}
