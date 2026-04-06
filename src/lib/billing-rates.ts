/**
 * Client-safe billing rate functions (no Prisma).
 * Use this for client components. Use @/lib/billing for server-side (includes Prisma).
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
  // No minimum charge for interpreters
  return minutes * perMinCents;
}

/**
 * Calculate interpreter pay using their individually-set rates (from admin panel).
 * Falls back to the default rate if no individual rate is set.
 * No minimum charge applies.
 */
export function interpreterPayCentsWithRates(
  durationSeconds: number,
  serviceType: string,
  targetLanguage: string,
  opiRateCents: number | null | undefined,
  vriRateCents: number | null | undefined,
  interpretationType: 'human' | 'ai' = 'human'
): number {
  if (interpretationType === 'ai') return 0;
  const minutes = Math.ceil(durationSeconds / 60);
  const isOpi = serviceType?.toUpperCase() === 'OPI';
  const individualRate = isOpi ? opiRateCents : vriRateCents;
  // Use individual rate if set, otherwise fall back to default (no minimum)
  const perMinCents = individualRate != null
    ? individualRate
    : isSpanish(targetLanguage) ? 25 : 45;
  return minutes * perMinCents;
}

/**
 * Calculate client charge using per-organization rates set in the admin panel.
 * Falls back to default rates if no org-specific rate is set.
 * AI interpretation always uses fixed platform rates.
 */
export function clientChargeCentsWithRates(
  durationSeconds: number,
  serviceType: string,
  targetLanguage: string,
  opiRateCentsSpanish: number | null | undefined,
  vriRateCentsSpanish: number | null | undefined,
  opiRateCentsOther: number | null | undefined,
  vriRateCentsOther: number | null | undefined,
  interpretationType: 'human' | 'ai' = 'human'
): number {
  const minutes = Math.ceil(durationSeconds / 60);
  if (interpretationType === 'ai') {
    const perMinCents = isSpanish(targetLanguage) ? 49 : 59;
    return Math.max(minutes * perMinCents, 250);
  }
  const isOpi = serviceType?.toUpperCase() === 'OPI';
  const isSpanishLang = isSpanish(targetLanguage);
  let perMinCents: number;
  if (isSpanishLang) {
    perMinCents = isOpi ? (opiRateCentsSpanish ?? 89) : (vriRateCentsSpanish ?? 89);
  } else {
    perMinCents = isOpi ? (opiRateCentsOther ?? 119) : (vriRateCentsOther ?? 119);
  }
  return Math.max(minutes * perMinCents, 500);
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
    const isSp = isSpanishLang(lang);
    rows.push(
      { language: lang, interpretationType: 'Human', opiPerMin: isSp ? 89 : 119, vriPerMin: isSp ? 89 : 119, minimumCents: 500 },
      { language: lang, interpretationType: 'AI', opiPerMin: isSp ? 49 : 59, vriPerMin: isSp ? 49 : 59, minimumCents: 250 },
    );
  }
  return rows;
})();
