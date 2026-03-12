/**
 * Language mappings for Deepgram (STT) and Google Cloud Translation.
 * Replaces Azure-specific mappings.
 */

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  'es-ES': 'Spanish',
  'es-MX': 'Spanish (Mexico)',
  'zh-cmn': 'Chinese Mandarin',
  'zh-Hans': 'Chinese Simplified',
  'zh-Hant': 'Chinese Traditional',
  yue: 'Chinese Cantonese',
  ar: 'Arabic',
  vi: 'Vietnamese',
  ko: 'Korean',
  ru: 'Russian',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  hi: 'Hindi',
  th: 'Thai',
  pl: 'Polish',
  tr: 'Turkish',
  tl: 'Tagalog',
  am: 'Amharic',
  bn: 'Bengali',
  ht: 'Haitian Creole',
  fa: 'Farsi',
  uk: 'Ukrainian',
  ur: 'Urdu',
  hmn: 'Hmong',
  so: 'Somali',
  sw: 'Swahili',
  nl: 'Dutch',
  el: 'Greek',
  he: 'Hebrew',
  pa: 'Punjabi',
};

/** Get display name for a language code */
export function getLanguageDisplayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

/** Map our language codes to Deepgram language codes (ISO 639-1 style) */
const DEEPGRAM_LANG_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'es-US': 'es',
  'zh-cmn': 'zh',
  'zh-Hans': 'zh',
  'zh-Hant': 'zh-TW',
  yue: 'yue',
  ar: 'ar',
  vi: 'vi',
  ko: 'ko',
  ru: 'ru',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  ja: 'ja',
  hi: 'hi',
  th: 'th',
  pl: 'pl',
  tr: 'tr',
};

export function toDeepgramLanguage(code: string): string {
  return DEEPGRAM_LANG_MAP[code] ?? code.split('-')[0] ?? code;
}

/** Map our language codes to Google Cloud Translation language codes */
const GOOGLE_LANG_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  'es-ES': 'es',
  'es-MX': 'es',
  'zh-cmn': 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  yue: 'yue',
  ar: 'ar',
  vi: 'vi',
  ko: 'ko',
  ru: 'ru',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  ja: 'ja',
  hi: 'hi',
  th: 'th',
  pl: 'pl',
  tr: 'tr',
};

export function toGoogleLanguage(code: string): string {
  return GOOGLE_LANG_MAP[code] ?? code;
}

/** Map to UI format (e.g. en-US for join modal) - same as legacy Azure format */
const UI_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  'zh-cmn': 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  yue: 'yue-HK',
  ar: 'ar-SA',
  vi: 'vi-VN',
  ko: 'ko-KR',
  ru: 'ru-RU',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ja: 'ja-JP',
  hi: 'hi-IN',
  th: 'th-TH',
  pl: 'pl-PL',
  tr: 'tr-TR',
};

export function toUiLanguage(code: string): string {
  return UI_LANG_MAP[code] ?? code;
}
