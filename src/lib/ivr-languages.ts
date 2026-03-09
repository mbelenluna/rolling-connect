/**
 * IVR language list: matches online form exactly.
 * Order: Spanish, Mandarin, Cantonese, then Korean, Vietnamese, Tagalog, Armenian, Russian, Farsi, Arabic, Japanese, then the rest.
 * No "Other" — every language has its own number.
 */
import { FORM_LANGUAGES } from './form-languages';

export type IvrLanguage = { code: string; name: string; digit: string };

const IVR_FIRST = [
  { code: 'es', name: 'Spanish' },
  { code: 'zh-cmn', name: 'Chinese Mandarin' },
  { code: 'yue', name: 'Chinese Cantonese' },
];

const IVR_PRIORITY = [
  { code: 'ko', name: 'Korean' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'hy', name: 'Armenian' },
  { code: 'ru', name: 'Russian' },
  { code: 'fa', name: 'Farsi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ja', name: 'Japanese' },
];

const PRIORITY_CODES = new Set([...IVR_FIRST, ...IVR_PRIORITY].map((l) => l.code));
const REST = FORM_LANGUAGES.filter((l) => !PRIORITY_CODES.has(l.code)).sort((a, b) => a.name.localeCompare(b.name));

const IVR_ORDER: IvrLanguage[] = [...IVR_FIRST, ...IVR_PRIORITY, ...REST].map((l, i) => ({
  ...l,
  digit: String(i + 1).padStart(2, '0'),
}));

/** Digit (01–58) → language. Source is always English for US callers. */
export const IVR_LANGUAGE_MAP: Record<string, { source: string; target: string; spokenName: string }> =
  Object.fromEntries(
    IVR_ORDER.map((l) => [
      l.digit,
      { source: 'en', target: l.code, spokenName: l.name },
    ])
  );

/** Build spoken prompt: "For Spanish, press 01. For Chinese Mandarin, press 02. ..." */
export function buildIvrLanguagePrompt(): string {
  return IVR_ORDER.map((l) => `For ${l.name}, press ${l.digit}.`).join(' ');
}

export { IVR_ORDER };
