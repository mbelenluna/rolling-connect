import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  status: z.enum(['online', 'offline', 'busy']),
  workingHours: z.record(z.object({ start: z.string(), end: z.string() })).optional(),
});

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id?: string }).id!;
  const body = await req.json();
  const data = schema.parse(body);

  await prisma.interpreterAvailability.upsert({
    where: { userId },
    update: { status: data.status, workingHours: data.workingHours ?? undefined },
    create: { userId, status: data.status, workingHours: data.workingHours ?? undefined },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const avail = await prisma.interpreterAvailability.findUnique({
    where: { userId: (session.user as { id?: string }).id },
  });

  return NextResponse.json(avail || { status: 'offline' });
}
