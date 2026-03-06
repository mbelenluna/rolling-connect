/**
 * Create an interpretation request from phone IVR (no session).
 * Used when callers dial in and enter client ID + language via keypad.
 */
import { prisma } from './prisma';
import { findEligibleInterpreters } from './matching';
import { cancelStaleJobs } from './cancel-job';

const OFFER_TIMEOUT_SEC = 60;
const LOG_PREFIX = '[phone-request]';

/** DTMF digit → target language code (source is always English for US callers) */
export const IVR_LANGUAGE_MAP: Record<string, { source: string; target: string }> = {
  '1': { source: 'en', target: 'es' },
  '2': { source: 'en', target: 'zh' },
  '3': { source: 'en', target: 'ar' },
  '4': { source: 'en', target: 'vi' },
  '5': { source: 'en', target: 'ko' },
  '6': { source: 'en', target: 'ru' },
  '7': { source: 'en', target: 'fr' },
  '8': { source: 'en', target: 'en' }, // fallback / other
};

export type CreatePhoneRequestResult =
  | { ok: true; requestId: string; jobId: string; interpretersMatched: number }
  | { ok: false; error: 'INVALID_CLIENT_ID' | 'INVALID_LANGUAGE' | 'ORG_NOT_APPROVED' | 'NO_OWNER' };

export async function createPhoneRequest(
  phoneClientId: string,
  languageDigit: string
): Promise<CreatePhoneRequestResult> {
  const lang = IVR_LANGUAGE_MAP[languageDigit];
  if (!lang) {
    console.warn(LOG_PREFIX, 'Invalid language digit', { languageDigit });
    return { ok: false, error: 'INVALID_LANGUAGE' };
  }

  const org = await prisma.organization.findFirst({
    where: { phoneClientId: phoneClientId.trim() },
    include: {
      members: {
        where: { role: 'owner' },
        include: { user: { select: { id: true, approvedAt: true, rejectedAt: true } } },
      },
    },
  });

  if (!org) {
    console.warn(LOG_PREFIX, 'Invalid client ID', { phoneClientId });
    return { ok: false, error: 'INVALID_CLIENT_ID' };
  }

  const owner = org.members[0]?.user;
  if (!owner) {
    console.warn(LOG_PREFIX, 'No owner for org', { orgId: org.id });
    return { ok: false, error: 'NO_OWNER' };
  }

  if (!owner.approvedAt || owner.rejectedAt) {
    console.warn(LOG_PREFIX, 'Org owner not approved', { orgId: org.id });
    return { ok: false, error: 'ORG_NOT_APPROVED' };
  }

  cancelStaleJobs().catch((e) => console.error(LOG_PREFIX, 'cancelStaleJobs error:', e));

  const request = await prisma.interpretationRequest.create({
    data: {
      organizationId: org.id,
      createdByUserId: owner.id,
      interpretationType: 'human',
      serviceType: 'OPI',
      sourceLanguage: lang.source,
      targetLanguage: lang.target,
      specialty: 'general',
      scheduleType: 'now',
      status: 'matching',
      estimatedDurationMinutes: 15,
      urgency: 'normal',
      recordingConsent: false,
      securityClearance: false,
    },
  });

  const interpreters = await findEligibleInterpreters({
    sourceLanguage: lang.source,
    targetLanguage: lang.target,
    specialty: 'general',
  });

  console.log(LOG_PREFIX, 'Created request', {
    requestId: request.id,
    orgId: org.id,
    sourceLanguage: lang.source,
    targetLanguage: lang.target,
    interpretersFound: interpreters.length,
  });

  const offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT_SEC * 1000);
  const offeredToIds = interpreters.map((i) => i.id);

  const job = await prisma.job.create({
    data: {
      requestId: request.id,
      status: interpreters.length > 0 ? 'offered' : 'expired',
      offerExpiresAt,
      offeredToIds,
    },
  });

  await prisma.interpretationRequest.update({
    where: { id: request.id },
    data: { status: interpreters.length > 0 ? 'offered' : 'canceled' },
  });

  if (interpreters.length > 0) {
    const { publishRequestStatus } = await import('@/lib/realtime/server');
    publishRequestStatus(request.id, {
      status: 'offered',
      timestamp: Date.now(),
      requestId: request.id,
    }).catch((e) => console.error(LOG_PREFIX, 'publishRequestStatus:', e));
  }

  return {
    ok: true,
    requestId: request.id,
    jobId: job.id,
    interpretersMatched: interpreters.length,
  };
}
