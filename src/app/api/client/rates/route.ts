import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/client/rates
 * Returns the calling client's organization billing rates.
 * Falls back to null for each field if not set (UI uses platform defaults).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        select: {
          opiRateCentsSpanish: true,
          vriRateCentsSpanish: true,
          opiRateCentsOther: true,
          vriRateCentsOther: true,
        },
      },
    },
  });

  const org = membership?.organization ?? null;
  return NextResponse.json({
    opiRateCentsSpanish: org?.opiRateCentsSpanish ?? null,
    vriRateCentsSpanish: org?.vriRateCentsSpanish ?? null,
    opiRateCentsOther:   org?.opiRateCentsOther   ?? null,
    vriRateCentsOther:   org?.vriRateCentsOther   ?? null,
  });
}
