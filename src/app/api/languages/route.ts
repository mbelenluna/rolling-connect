import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const FALLBACK_LANGUAGES = [
  { id: 'fallback-en', code: 'en', name: 'English', active: true },
  { id: 'fallback-es', code: 'es', name: 'Spanish', active: true },
  { id: 'fallback-zh', code: 'zh', name: 'Chinese', active: true },
  { id: 'fallback-ar', code: 'ar', name: 'Arabic', active: true },
  { id: 'fallback-vi', code: 'vi', name: 'Vietnamese', active: true },
  { id: 'fallback-ko', code: 'ko', name: 'Korean', active: true },
  { id: 'fallback-ru', code: 'ru', name: 'Russian', active: true },
  { id: 'fallback-fr', code: 'fr', name: 'French', active: true },
];

export async function GET() {
  const languages = await prisma.language.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(languages.length > 0 ? languages : FALLBACK_LANGUAGES);
}
