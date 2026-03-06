import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  phoneClientId: z.string().min(4).max(20).regex(/^[0-9a-zA-Z]+$/).nullable(),
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
      data: { phoneClientId: data.phoneClientId === null ? null : data.phoneClientId ?? undefined },
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
