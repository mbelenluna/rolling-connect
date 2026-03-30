import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findEligibleInterpreters, findEligibleInterpretersWithDebug } from '@/lib/matching';
import { cancelStaleJobs } from '@/lib/cancel-job';
import { z } from 'zod';

const OFFER_TIMEOUT_SEC = 35;
const LOG_PREFIX = '[requests POST]';

const schema = z.object({
  interpretationType: z.enum(['human', 'ai']).default('human'),
  serviceType: z.enum(['OPI', 'VRI']),
  sourceLanguage: z.string(),
  targetLanguage: z.string().min(1, 'Target language is required'),
  specialty: z.string(),
  industry: z.string().optional(),
  costCenter: z.string().optional(),
  certificationLevel: z.string().optional(),
  yearsExperience: z.number().optional(),
  securityClearance: z.boolean().optional(),
  genderPreference: z.string().optional(),
  dialect: z.string().optional(),
  notes: z.string().optional(),
  estimatedDurationMinutes: z.number().default(15),
  urgency: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  recordingConsent: z.boolean().default(false),
  scheduleType: z.enum(['now', 'scheduled']),
  scheduledAt: z.string().datetime().optional().nullable(),
  timeZone: z.string().optional(),
  organizationId: z.string(),
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user) {
    console.warn(LOG_PREFIX, 'Unauthorized: no session');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'client' && role !== 'admin') {
    console.warn(LOG_PREFIX, 'Forbidden: role=', role);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (role === 'client') {
    const clientUser = await prisma.user.findUnique({
      where: { id: (session.user as { id?: string }).id },
      select: { approvedAt: true, rejectedAt: true },
    });
    if (!clientUser?.approvedAt || clientUser.rejectedAt) {
      console.warn(LOG_PREFIX, 'Client pending approval', { userId });
      return NextResponse.json(
        { error: 'CLIENT_PENDING_APPROVAL' },
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const orgMember = await prisma.organizationMember.findFirst({
      where: { organizationId: data.organizationId, userId: (session.user as { id?: string }).id },
    });
    if (!orgMember) {
      console.warn(LOG_PREFIX, 'Organization access denied', { userId, organizationId: data.organizationId });
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    // Billing gate: org owner must have active billing
    const { requireActiveBilling, getOrgOwnerId } = await import('@/lib/billing');
    const ownerId = await getOrgOwnerId(data.organizationId);
    if (ownerId) {
      const billing = await requireActiveBilling(ownerId);
      if (!billing.ok) {
        console.warn(LOG_PREFIX, 'Billing requires reauthorization', { userId, organizationId: data.organizationId });
        return NextResponse.json(
          { ok: false, error: 'Billing authorization required', code: 'BILLING_REAUTH_REQUIRED' },
          { status: 402 }
        );
      }
    }

    const isAI = data.interpretationType === 'ai';
    console.log(LOG_PREFIX, 'Creating request', { userId, role, interpretationType: data.interpretationType, sourceLanguage: data.sourceLanguage, targetLanguage: data.targetLanguage, specialty: data.specialty });

    const request = await prisma.interpretationRequest.create({
      data: {
        organizationId: data.organizationId,
        createdByUserId: (session.user as { id?: string }).id!,
        interpretationType: data.interpretationType,
        serviceType: data.serviceType,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        specialty: data.specialty,
        industry: data.industry,
        costCenter: data.costCenter,
        certificationLevel: data.certificationLevel,
        yearsExperience: data.yearsExperience,
        securityClearance: data.securityClearance ?? false,
        genderPreference: data.genderPreference,
        dialect: data.dialect,
        notes: data.notes,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
        urgency: data.urgency,
        recordingConsent: data.recordingConsent,
        scheduleType: data.scheduleType,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        timeZone: data.timeZone,
        status: isAI ? 'assigned' : 'matching',
      },
    });

    if (isAI) {
      const job = await prisma.job.create({
        data: {
          requestId: request.id,
          status: 'assigned',
          assignedInterpreterId: null,
        },
      });
      const { generateUniquePhoneSessionCode } = await import('@/lib/session-code');
      const phoneSessionCode = await generateUniquePhoneSessionCode();
      await prisma.call.create({
        data: {
          jobId: job.id,
          // OPI uses Twilio Conference (rolling-* prefix); VRI uses Daily.co
          roomId: data.serviceType === 'OPI'
            ? `rolling-${job.id.replace(/[^a-zA-Z0-9-]/g, '-')}`
            : `room_${job.id}_${Date.now()}`,
          phoneSessionCode,
        },
      });
      return NextResponse.json({
        id: request.id,
        jobId: job.id,
        status: 'assigned',
        interpretationType: 'ai',
        interpretersMatched: 0,
        createdAt: request.createdAt,
      });
    }

    cancelStaleJobs().catch((e) => console.error(LOG_PREFIX, 'cancelStaleJobs error:', e));

    const matchParams = {
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      specialty: data.specialty,
      dialect: data.dialect,
      certificationLevel: data.certificationLevel,
      yearsExperience: data.yearsExperience,
      securityClearance: data.securityClearance,
      genderPreference: data.genderPreference,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    };
    const interpreters = await findEligibleInterpreters(matchParams);

    console.log(LOG_PREFIX, 'Matching result', { requestId: request.id, interpretersFound: interpreters.length, interpreterIds: interpreters.map((i) => i.id) });

    const offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT_SEC * 1000);
    const offeredToIds = interpreters.map((i) => i.id);

    const job = await prisma.job.create({
      data: {
        requestId: request.id,
        status: 'offered',
        offerExpiresAt,
        offeredToIds,
      },
    });

    await prisma.interpretationRequest.update({
      where: { id: request.id },
      data: { status: 'offered' },
    });

    // Publish via Ably (Vercel-compatible). Interpreters get offers via /api/interpreter/offers polling.
    const { publishRequestStatus } = await import('@/lib/realtime/server');
    publishRequestStatus(request.id, {
      status: 'offered',
      timestamp: Date.now(),
      requestId: request.id,
    }).catch((e) => console.error(LOG_PREFIX, 'publishRequestStatus:', e));

    const responseStatus = interpreters.length > 0 ? 'offered' : 'no_match';
    console.log(LOG_PREFIX, 'Success', { requestId: request.id, jobId: job.id, status: responseStatus, interpretersMatched: interpreters.length });

    let matchDebug: { counts: { totalInterpreters: number; statusOnline: number; languageMatch: number; specialtyMatch: number; finalEligible: number }; topReasons?: string[] } | undefined;
    if (interpreters.length === 0) {
      try {
        const { debug } = await findEligibleInterpretersWithDebug(matchParams);
        const topReasons = Array.from(new Set(debug.filterReasons.map((r) => r.reason))).slice(0, 5);
        matchDebug = {
          counts: {
            totalInterpreters: debug.totalInterpreters,
            statusOnline: debug.statusOnline,
            languageMatch: debug.languageMatch,
            specialtyMatch: debug.specialtyMatch,
            finalEligible: debug.finalEligible,
          },
          topReasons,
        };
      } catch (e) {
        console.warn(LOG_PREFIX, 'Match debug failed', e);
      }
    }

    return NextResponse.json({
      id: request.id,
      jobId: job.id,
      status: responseStatus,
      interpretersMatched: interpreters.length,
      createdAt: request.createdAt,
      estimatedMatchTime: OFFER_TIMEOUT_SEC,
      ...(matchDebug && { matchDebug }),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      console.warn(LOG_PREFIX, 'Validation error', e.errors);
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error(LOG_PREFIX, 'Error', e);
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('organizationId');
  const status = searchParams.get('status');
  const startMonth = searchParams.get('startMonth'); // YYYY-MM (legacy)
  const endMonth = searchParams.get('endMonth'); // YYYY-MM (legacy)
  const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD
  const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD

  const where: Record<string, unknown> = {};
  if (orgId) where.organizationId = orgId;
  if (status) where.status = status as never;

  // Filter by call ended date range (for client history reports)
  if (status === 'completed') {
    if (startDateParam && endDateParam) {
      // New date range filter (YYYY-MM-DD)
      const startDate = new Date(startDateParam + 'T00:00:00.000Z');
      const endDate = new Date(endDateParam + 'T23:59:59.999Z');
      where.jobs = {
        some: {
          call: {
            endedAt: { gte: startDate, lte: endDate },
          },
        },
      };
    } else if (startMonth && (endMonth || startMonth)) {
      // Legacy month filter (YYYY-MM)
      const rangeEndMonth = endMonth || startMonth;
      const [startY, startM] = startMonth.split('-').map(Number);
      const [endY, endM] = rangeEndMonth.split('-').map(Number);
      const startDate = new Date(startY, startM - 1, 1);
      const endDate = new Date(endY, endM, 0, 23, 59, 59, 999);
      where.jobs = {
        some: {
          call: {
            endedAt: { gte: startDate, lte: endDate },
          },
        },
      };
    }
  }

  const role = (session.user as { role?: string }).role;
  const userId = (session.user as { id?: string }).id;
  if (role === 'client') {
    where.createdByUserId = userId;
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length) where.organizationId = orgId && orgIds.includes(orgId) ? orgId : orgIds.length === 1 ? orgIds[0] : { in: orgIds };
  }

  const requests = await prisma.interpretationRequest.findMany({
    where,
    include: {
      jobs: { include: { assignedInterpreter: { select: { name: true, id: true } }, call: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: (startDateParam && endDateParam) || (startMonth && endMonth) ? 500 : 50,
  });

  return NextResponse.json(requests);
}
