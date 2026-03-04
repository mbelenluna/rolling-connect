import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const languages = await prisma.language.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(languages);
}
