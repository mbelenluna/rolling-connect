import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateSchema = z.object({
  languagePairs: z.array(z.object({ source: z.string(), target: z.string() })).min(1, 'At least one language pair required'),
  specialties: z.array(z.string()).min(1, 'At least one specialty required'),
  timeZone: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const profile = await prisma.interpreterProfile.findUnique({
    where: { userId: (session.user as { id?: string }).id },
  });

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  return NextResponse.json({
    languagePairs: profile.languagePairs as { source: string; target: string }[],
    specialties: profile.specialties as string[],
    timeZone: profile.timeZone,
    maxConcurrentJobs: profile.maxConcurrentJobs,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as { role?: string }).role !== 'interpreter') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id?: string }).id!;
  const body = await req.json();
  const data = updateSchema.parse(body);

  await prisma.interpreterProfile.update({
    where: { userId },
    data: {
      languagePairs: data.languagePairs,
      specialties: data.specialties,
      timeZone: data.timeZone,
    },
  });

  return NextResponse.json({ success: true });
}
