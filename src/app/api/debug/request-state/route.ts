/**
 * Admin-only debug endpoint to inspect request state and matching counts.
 * GET /api/debug/request-state?requestId=xxx
 * Or with params for matching simulation: ?sourceLanguage=en&targetLanguage=es&specialty=medical
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findEligibleInterpretersWithDebug } from '@/lib/matching';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const sourceLanguage = searchParams.get('sourceLanguage') || 'en';
  const targetLanguage = searchParams.get('targetLanguage') || 'es';
  const specialty = searchParams.get('specialty') || 'medical';

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    requestId,
    matchingParams: { sourceLanguage, targetLanguage, specialty },
  };

  if (requestId) {
    const request = await prisma.interpretationRequest.findFirst({
      where: { id: requestId },
      include: {
        jobs: {
          include: {
            assignedInterpreter: { select: { id: true, name: true, email: true } },
            call: true,
          },
        },
        organization: { select: { id: true, name: true } },
      },
    });

    if (!request) {
      result.request = null;
      result.error = 'Request not found';
    } else {
      result.request = {
        id: request.id,
        status: request.status,
        createdByUserId: request.createdByUserId,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        specialty: request.specialty,
        createdAt: request.createdAt.toISOString(),
        organizationId: request.organizationId,
        organizationName: request.organization?.name,
        jobs: request.jobs.map((j) => ({
          id: j.id,
          status: j.status,
          offerExpiresAt: j.offerExpiresAt?.toISOString() ?? null,
          offeredToIds: j.offeredToIds,
          assignedInterpreterId: j.assignedInterpreterId,
          assignedInterpreter: j.assignedInterpreter,
          callId: j.call?.id,
          roomId: j.call?.roomId,
        })),
      };
    }
  }

  const { interpreters, debug } = await findEligibleInterpretersWithDebug({
    sourceLanguage,
    targetLanguage,
    specialty,
  });

  result.matchingCounts = {
    totalInterpreters: debug.totalInterpreters,
    approvedInterpreters: debug.approvedInterpreters,
    withProfile: debug.withProfile,
    withAvailability: debug.withAvailability,
    statusOnline: debug.statusOnline,
    languageMatch: debug.languageMatch,
    specialtyMatch: debug.specialtyMatch,
    notAtCapacity: debug.notAtCapacity,
    finalEligible: debug.finalEligible,
  };

  result.filterReasons = debug.filterReasons;
  result.matchedIds = interpreters.map((i) => ({ id: i.id, name: i.name, email: i.email }));

  result.ablyConfigured = !!process.env.ABLY_API_KEY;

  return NextResponse.json(result);
}
