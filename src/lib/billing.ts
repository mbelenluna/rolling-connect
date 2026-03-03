/**
 * Billing rates for interpretation calls.
 * Spanish: $0.50/min client, $0.25/min interpreter
 * Other languages: $0.90/min client, $0.45/min interpreter
 * Minimum: $5 client, $2.50 interpreter
 */

const SPANISH_CODES = ['es', 'es-ES', 'es-MX', 'es-US'];

export function isSpanish(langCode: string): boolean {
  const base = langCode.split('-')[0].toLowerCase();
  return base === 'es' || SPANISH_CODES.includes(langCode.toLowerCase());
}

export function clientChargeCents(durationSeconds: number, targetLanguage: string): number {
  const minutes = Math.ceil(durationSeconds / 60);
  const perMinCents = isSpanish(targetLanguage) ? 50 : 90;
  const charge = minutes * perMinCents;
  const minCents = 500; // $5
  return Math.max(charge, minCents);
}

export function interpreterPayCents(durationSeconds: number, targetLanguage: string): number {
  const minutes = Math.ceil(durationSeconds / 60);
  const perMinCents = isSpanish(targetLanguage) ? 25 : 45;
  const pay = minutes * perMinCents;
  const minCents = 250; // $2.50
  return Math.max(pay, minCents);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
