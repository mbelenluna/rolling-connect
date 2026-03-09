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

import { prisma } from './prisma';

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
    const isSp = isSpanishLang(lang);
    rows.push(
      { language: lang, interpretationType: 'Human', opiPerMin: isSp ? 89 : 119, vriPerMin: isSp ? 89 : 119, minimumCents: 500 },
      { language: lang, interpretationType: 'AI', opiPerMin: isSp ? 49 : 59, vriPerMin: isSp ? 49 : 59, minimumCents: 250 },
    );
  }
  return rows;
})();

// --- Billing gate: require active billing for paid platform actions ---

/** Statuses that block paid platform usage */
const BLOCKED_BILLING_STATUSES = new Set([
  'REQUIRES_REAUTHORIZATION',
  'CANCELED',
]);

export type BillingCheckResult =
  | { ok: true }
  | { ok: false; error: string; code: 'BILLING_REAUTH_REQUIRED'; status: 402 };

/**
 * Check if a user has active billing. Returns { ok: false } if blocked.
 * Use for clients/org owners who pay for interpretation.
 */
export async function requireActiveBilling(userId: string): Promise<BillingCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      billingDisabledAt: true,
      billingDisabledReason: true,
    },
  });

  if (!user) {
    return { ok: false, error: 'User not found', code: 'BILLING_REAUTH_REQUIRED', status: 402 };
  }

  if (BLOCKED_BILLING_STATUSES.has(user.subscriptionStatus)) {
    return {
      ok: false,
      error: 'Billing authorization required',
      code: 'BILLING_REAUTH_REQUIRED',
      status: 402,
    };
  }

  return { ok: true };
}

/**
 * Get org owner ID for billing check. Returns null if no owner.
 */
export async function getOrgOwnerId(organizationId: string): Promise<string | null> {
  const member = await prisma.organizationMember.findFirst({
    where: { organizationId, role: 'owner' },
    select: { userId: true },
  });
  return member?.userId ?? null;
}
