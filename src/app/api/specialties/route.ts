import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const FALLBACK_SPECIALTIES = [
  { id: 'fallback-medical', code: 'medical', name: 'Medical', active: true },
  { id: 'fallback-legal', code: 'legal', name: 'Legal', active: true },
  { id: 'fallback-customer_service', code: 'customer_service', name: 'Customer Service', active: true },
  { id: 'fallback-education', code: 'education', name: 'Education', active: true },
  { id: 'fallback-general', code: 'general', name: 'General', active: true },
  { id: 'fallback-other', code: 'other', name: 'Other', active: true },
];

export async function GET() {
  const specialties = await prisma.specialty.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(specialties.length > 0 ? specialties : FALLBACK_SPECIALTIES);
}
