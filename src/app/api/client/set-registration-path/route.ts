import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({ path: z.enum(['gocardless']) });

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { path } = schema.parse(body);

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.user.update({
    where: { id: userId },
    data: { registrationPath: path },
  });

  return NextResponse.json({ ok: true });
}
