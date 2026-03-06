/**
 * Billing rates for interpretation calls.
 *
 * Human interpretation:
 *   Spanish: $0.89/min client, $0.25/min interpreter. Minimum: $5 client, $2.50 interpreter
 *   Other: $1.19/min client, $0.45/min interpreter. Minimum: $5 client, $2.50 interpreter
 *
 * AI interpretation:
 *   Spanish: $0.49/min client. Minimum: $2.50
 *   Other: $0.59/min client. Minimum: $2.50
 *   (No interpreter pay)
 */

const SPANISH_CODES = ['es', 'es-ES', 'es-MX', 'es-US'];

export function isSpanish(langCode: string): boolean {
  const base = langCode.split('-')[0].toLowerCase();
  return base === 'es' || SPANISH_CODES.includes(langCode.toLowerCase());
}

export function clientChargeCents(
  durationSeconds: number,
  targetLanguage: string,
  interpretationType: 'human' | 'ai' = 'human'
): number {
  const minutes = Math.ceil(durationSeconds / 60);
  let perMinCents: number;
  let minCents: number;
  if (interpretationType === 'ai') {
    perMinCents = isSpanish(targetLanguage) ? 49 : 59;
    minCents = 250; // $2.50
  } else {
    perMinCents = isSpanish(targetLanguage) ? 89 : 119;
    minCents = 500; // $5
  }
  const charge = minutes * perMinCents;
  return Math.max(charge, minCents);
}

export function interpreterPayCents(
  durationSeconds: number,
  targetLanguage: string,
  interpretationType: 'human' | 'ai' = 'human'
): number {
  if (interpretationType === 'ai') return 0;
  const minutes = Math.ceil(durationSeconds / 60);
  const perMinCents = isSpanish(targetLanguage) ? 25 : 45;
  const pay = minutes * perMinCents;
  const minCents = 250; // $2.50
  return Math.max(pay, minCents);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** All languages for pricing table. Spanish gets lower rate; others get standard rate. */
const PRICING_LANGUAGES = [
  'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani', 'Bahamian', 'Bengali', 'Bosnian',
  'Bulgarian', 'Burmese', 'Cantonese', 'Catalan', 'Chao-Chow', 'Chinese', 'Czech', 'Dari',
  'Dutch', 'English', 'Farsi', 'Fijian', 'Finnish', 'French', 'Fukienese', 'Fuzhou', 'German',
  'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hebrew', 'Hindi', 'Hmong', 'Hungarian',
  'Ibibio (Ibo)', 'Ilocano', 'Indonesian', 'Italian', 'Japanese', 'Khmer', 'Korean', 'Lao',
  'Lithuanian', 'Malay', 'Mandarin', 'Mongolian', 'Nepali', 'Polish', 'Portuguese', 'Punjabi',
  'Romanian', 'Russian', 'Serbian', 'Simplified Chinese', 'Sinhalese', 'Somali', 'Spanish',
  'Swahili', 'Swedish', 'Tagalog', 'Taiwanese', 'Tamil', 'Thai', 'Toishanese', 'Tongan',
  'Traditional Chinese', 'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese',
].sort((a, b) => a.localeCompare(b));

const SPANISH_NAMES = ['spanish', 'español'];

function isSpanishLang(name: string): boolean {
  return SPANISH_NAMES.includes(name.toLowerCase());
}

/** Client rates for the pricing page. One row per language per type. Same for OPI and VRI. */
export const CLIENT_PRICING_TABLE = (() => {
  const rows: { language: string; interpretationType: 'Human' | 'AI'; opiPerMin: number; vriPerMin: number; minimumCents: number }[] = [];
  for (const lang of PRICING_LANGUAGES) {
    const isSpanish = isSpanishLang(lang);
    rows.push(
      { language: lang, interpretationType: 'Human', opiPerMin: isSpanish ? 89 : 119, vriPerMin: isSpanish ? 89 : 119, minimumCents: 500 },
      { language: lang, interpretationType: 'AI', opiPerMin: isSpanish ? 49 : 59, vriPerMin: isSpanish ? 49 : 59, minimumCents: 250 },
    );
  }
  return rows;
})();
