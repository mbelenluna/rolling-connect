/**
 * IVR language list: matches online form exactly.
 * Order: Spanish, Chinese Mandarin, Chinese Cantonese, then all others alphabetically.
 * No "Other" — every language has its own number.
 */
import { FORM_LANGUAGES } from './form-languages';

export type IvrLanguage = { code: string; name: string; digit: string };

/** IVR order: Spanish, Chinese Mandarin, Chinese Cantonese, then alphabetically by name. */
const IVR_FIRST = [
  { code: 'es', name: 'Spanish' },
  { code: 'zh-cmn', name: 'Chinese Mandarin' },
  { code: 'yue', name: 'Chinese Cantonese' },
];

const REST = FORM_LANGUAGES.filter(
  (l) => !IVR_FIRST.some((f) => f.code === l.code)
).sort((a, b) => a.name.localeCompare(b.name));

const IVR_ORDER: IvrLanguage[] = [...IVR_FIRST, ...REST].map((l, i) => ({
  ...l,
  digit: String(i + 1).padStart(2, '0'),
}));

/** Digit (01–59) → language. Source is always English for US callers. */
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
