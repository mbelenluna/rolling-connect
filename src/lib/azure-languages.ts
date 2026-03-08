/**
 * Display names for language codes (used in UI).
 */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  'es-ES': 'Spanish',
  'es-MX': 'Spanish (Mexico)',
  'zh-cmn': 'Chinese Mandarin',
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

/** Get display name for a language code (e.g. "en" → "English") */
export function getLanguageDisplayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
}

/**
 * Map our language codes to Azure Speech language codes.
 * Azure uses BCP-47 format (e.g. en-US, es-ES).
 */
const AZURE_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  'es-ES': 'es-ES',
  'es-MX': 'es-MX',
  'es-US': 'es-US',
  'zh-cmn': 'zh-CN',
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

export function toAzureLanguage(code: string): string {
  return AZURE_LANG_MAP[code] ?? code;
}

/**
 * Azure translation target uses short codes (e.g. "en", "zh-Hans").
 * Speech recognition uses full locale (en-US, zh-CN).
 * See: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=speech-translation
 */
const TRANSLATION_TARGET_MAP: Record<string, string[]> = {
  'en-US': ['en'],
  'es-ES': ['es'],
  'es-MX': ['es'],
  'zh-CN': ['zh-Hans'],
  'zh-TW': ['zh-Hant'],
  'ar-SA': ['ar'],
  'vi-VN': ['vi'],
  'ko-KR': ['ko'],
  'ru-RU': ['ru'],
  'fr-FR': ['fr'],
  'de-DE': ['de'],
  'it-IT': ['it'],
  'pt-BR': ['pt'],
  'ja-JP': ['ja'],
  'hi-IN': ['hi'],
  'th-TH': ['th'],
  'pl-PL': ['pl'],
  'tr-TR': ['tr'],
};

/** Get translation target code(s) for addTargetLanguage - tries short codes first */
export function toTranslationTarget(azureLocale: string): string {
  const targets = TRANSLATION_TARGET_MAP[azureLocale];
  if (targets) return targets[0];
  return azureLocale.split('-')[0] || azureLocale;
}

/** Keys to try when looking up translation in result.translations (Azure may use short or full) */
export function getTranslationLookupKeys(azureLocale: string): string[] {
  const short = toTranslationTarget(azureLocale);
  const keys = [short];
  if (short !== azureLocale) keys.push(azureLocale);
  return keys;
}
