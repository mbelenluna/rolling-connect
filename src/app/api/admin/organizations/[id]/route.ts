import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rateField = z.number().int().nonnegative().nullable().optional();

const patchSchema = z.object({
  phoneClientId: z.string().length(6).regex(/^[0-9]+$/).nullable().optional(),
  opiRateCentsSpanish: rateField,
  vriRateCentsSpanish: rateField,
  opiRateCentsOther: rateField,
  vriRateCentsOther: rateField,
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const org = await prisma.organization.update({
      where: { id },
      data: {
        ...(data.phoneClientId !== undefined ? { phoneClientId: data.phoneClientId ?? undefined } : {}),
        ...(data.opiRateCentsSpanish !== undefined ? { opiRateCentsSpanish: data.opiRateCentsSpanish } : {}),
        ...(data.vriRateCentsSpanish !== undefined ? { vriRateCentsSpanish: data.vriRateCentsSpanish } : {}),
        ...(data.opiRateCentsOther !== undefined ? { opiRateCentsOther: data.opiRateCentsOther } : {}),
        ...(data.vriRateCentsOther !== undefined ? { vriRateCentsOther: data.vriRateCentsOther } : {}),
      },
    });

    return NextResponse.json(org);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error('[admin/organizations] PATCH error:', e);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}
