/**
 * Create an interpretation request from phone IVR (no session).
 * Used when callers dial in and enter client ID + language via keypad.
 */
import { prisma } from './prisma';
import { findEligibleInterpreters } from './matching';
import { cancelStaleJobs } from './cancel-job';

const OFFER_TIMEOUT_SEC = 60;
const LOG_PREFIX = '[phone-request]';

/**
 * DTMF digits → target language (source is always English for US callers).
 * Keys are 2-digit strings (01, 02, ...). spokenName is used in IVR prompts.
 */
export const IVR_LANGUAGE_MAP: Record<string, { source: string; target: string; spokenName: string }> = {
  '01': { source: 'en', target: 'es', spokenName: 'Spanish' },
  '02': { source: 'en', target: 'zh-cmn', spokenName: 'Chinese Mandarin' },
  '03': { source: 'en', target: 'yue', spokenName: 'Chinese Cantonese' },
  '04': { source: 'en', target: 'ar', spokenName: 'Arabic' },
  '05': { source: 'en', target: 'vi', spokenName: 'Vietnamese' },
  '06': { source: 'en', target: 'ko', spokenName: 'Korean' },
  '07': { source: 'en', target: 'ru', spokenName: 'Russian' },
  '08': { source: 'en', target: 'fr', spokenName: 'French' },
  '09': { source: 'en', target: 'de', spokenName: 'German' },
  '10': { source: 'en', target: 'tl', spokenName: 'Tagalog' },
  '11': { source: 'en', target: 'pt', spokenName: 'Portuguese' },
  '12': { source: 'en', target: 'ja', spokenName: 'Japanese' },
  '13': { source: 'en', target: 'hi', spokenName: 'Hindi' },
  '14': { source: 'en', target: 'th', spokenName: 'Thai' },
  '15': { source: 'en', target: 'am', spokenName: 'Amharic' },
  '16': { source: 'en', target: 'bn', spokenName: 'Bengali' },
  '17': { source: 'en', target: 'ht', spokenName: 'Haitian Creole' },
  '18': { source: 'en', target: 'fa', spokenName: 'Farsi' },
  '19': { source: 'en', target: 'pl', spokenName: 'Polish' },
  '20': { source: 'en', target: 'it', spokenName: 'Italian' },
  '21': { source: 'en', target: 'tr', spokenName: 'Turkish' },
  '22': { source: 'en', target: 'uk', spokenName: 'Ukrainian' },
  '23': { source: 'en', target: 'ur', spokenName: 'Urdu' },
  '24': { source: 'en', target: 'hmn', spokenName: 'Hmong' },
  '25': { source: 'en', target: 'so', spokenName: 'Somali' },
  '26': { source: 'en', target: 'sw', spokenName: 'Swahili' },
  '27': { source: 'en', target: 'nl', spokenName: 'Dutch' },
  '28': { source: 'en', target: 'el', spokenName: 'Greek' },
  '29': { source: 'en', target: 'he', spokenName: 'Hebrew' },
  '30': { source: 'en', target: 'pa', spokenName: 'Punjabi' },
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

  // Create Call immediately so caller can be put in Twilio Conference (stays on line until interpreter joins)
  const conferenceName = `rolling-${job.id.replace(/[^a-zA-Z0-9-]/g, '-')}`;
  await prisma.call.create({
    data: {
      jobId: job.id,
      roomId: conferenceName,
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
