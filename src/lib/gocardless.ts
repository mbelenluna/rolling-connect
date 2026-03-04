/**
 * GoCardless client wrapper - server-only.
 * Handles redirect flow creation/completion and webhook signature verification.
 */

import gocardless, { Environments } from 'gocardless-nodejs';
import { verifySignature } from 'gocardless-nodejs/webhooks';
import crypto from 'crypto';

function getClient() {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  const env = process.env.GOCARDLESS_ENV || 'sandbox';
  if (!token) {
    throw new Error(
      'GOCARDLESS_ACCESS_TOKEN is required. Set it in your environment for billing features.'
    );
  }
  const environment = env === 'live' ? Environments.Live : Environments.Sandbox;
  return gocardless(token, environment);
}

export type CreateRedirectFlowParams = {
  user: { email: string; name: string };
  successUrl: string;
  sessionToken: string;
};

export type CreateRedirectFlowResult = {
  redirectFlowId: string;
  redirectUrl: string;
  sessionToken: string;
};

export async function createRedirectFlow(
  params: CreateRedirectFlowParams
): Promise<CreateRedirectFlowResult> {
  const client = getClient();
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    throw new Error('NEXTAUTH_URL is required for GoCardless redirect flow.');
  }

  const [givenName, ...familyParts] = (params.user.name || '').trim().split(/\s+/);
  const familyName = familyParts.join(' ') || givenName;

  const flow = await client.redirectFlows.create({
    description: 'Rolling Connect subscription',
    session_token: params.sessionToken,
    success_redirect_url: params.successUrl,
    prefilled_customer: {
      email: params.user.email,
      given_name: givenName || params.user.email.split('@')[0],
      family_name: familyName,
    },
  });

  const redirectFlowId = flow.id ?? '';
  const redirectUrl = flow.redirect_url ?? '';
  if (!redirectFlowId || !redirectUrl) {
    throw new Error('GoCardless redirect flow missing id or redirect_url');
  }

  return {
    redirectFlowId,
    redirectUrl,
    sessionToken: params.sessionToken,
  };
}

export type CompleteRedirectFlowParams = {
  redirectFlowId: string;
  sessionToken: string;
};

export type CompleteRedirectFlowResult = {
  customerId: string;
  mandateId: string;
  bankAccountId: string;
};

export async function completeRedirectFlow(
  params: CompleteRedirectFlowParams
): Promise<CompleteRedirectFlowResult> {
  const client = getClient();
  const flow = await client.redirectFlows.complete(params.redirectFlowId, {
    session_token: params.sessionToken,
  });

  const customerId = flow.links?.customer ?? '';
  const mandateId = flow.links?.mandate ?? '';
  const bankAccountId = flow.links?.customer_bank_account ?? '';

  if (!customerId || !mandateId || !bankAccountId) {
    throw new Error(
      'GoCardless redirect flow complete missing customer, mandate, or bank_account links'
    );
  }

  return { customerId, mandateId, bankAccountId };
}

/**
 * Verify webhook signature. Throws if invalid.
 * Use raw body string - do not JSON.parse before calling.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): void {
  const secret = process.env.GOCARDLESS_WEBHOOK_ENDPOINT_SECRET;
  if (!secret) {
    throw new Error('GOCARDLESS_WEBHOOK_ENDPOINT_SECRET is required for webhook verification');
  }
  if (!signatureHeader) {
    throw new Error('Missing Webhook-Signature header');
  }
  verifySignature(rawBody, secret, signatureHeader);
}

/**
 * Generate a cryptographically strong session token for redirect flow.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
