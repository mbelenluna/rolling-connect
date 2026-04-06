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

// Re-export client-safe functions for server-side use
export { isSpanish, clientChargeCents, interpreterPayCents, interpreterPayCentsWithRates, formatCents, CLIENT_PRICING_TABLE } from './billing-rates';

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
