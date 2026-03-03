import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const specialties = await prisma.specialty.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(specialties);
}
