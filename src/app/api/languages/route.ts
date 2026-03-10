import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FORM_LANGUAGES } from '@/lib/form-languages';

export const dynamic = 'force-dynamic';

/** Chinese: only Mandarin and Cantonese. Exclude generic "Chinese" and duplicates. */
const CHINESE_CODES_TO_KEEP = new Set(['zh-cmn', 'yue']);
const CHINESE_NAMES_TO_EXCLUDE = new Set([
  'Chinese',
  'Simplified Chinese',
  'Traditional Chinese',
  'Chinese Simplified',
  'Chinese Traditional',
]);

function isDuplicateChinese(lang: { code: string; name: string }): boolean {
  if (CHINESE_CODES_TO_KEEP.has(lang.code)) return false;
  if (lang.code === 'zh' || (lang.code.startsWith('zh-') && lang.code !== 'zh-cmn')) return true;
  if (CHINESE_NAMES_TO_EXCLUDE.has(lang.name)) return true;
  if (lang.name === 'Chinese') return true;
  if (lang.name.startsWith('Chinese ') && lang.name !== 'Chinese Mandarin' && lang.name !== 'Chinese Cantonese') return true;
  return false;
}

const FALLBACK_LANGUAGES = FORM_LANGUAGES.map((l, i) => ({
  id: `fallback-${l.code}`,
  code: l.code,
  name: l.name,
  active: true,
}));

export async function GET() {
  let languages = await prisma.language.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  if (languages.length === 0) {
    languages = FALLBACK_LANGUAGES;
  }
  const filtered = languages.filter(
    (l) => !isDuplicateChinese({ code: l.code, name: l.name }) && l.code !== 'en'
  );
  // Normalize display names for zh-cmn and yue (DB may have old "Chinese"/"Cantonese")
  const normalized = filtered.map((l) => {
    if (l.code === 'zh-cmn') return { ...l, name: 'Chinese Mandarin' };
    if (l.code === 'yue') return { ...l, name: 'Chinese Cantonese' };
    return l;
  });
  // Include English first for source language (default: "I speak English")
  const englishEntry = { id: 'fallback-en', code: 'en', name: 'English', active: true };
  return NextResponse.json([englishEntry, ...normalized]);
}
