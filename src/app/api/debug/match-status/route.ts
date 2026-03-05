import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findEligibleInterpreters, findEligibleInterpretersWithDebug } from '@/lib/matching';

type LanguagePair = { source?: string; target?: string };

/**
 * Admin-only debug endpoint to verify matching and socket status.
 * Call with ?sourceLanguage=en&targetLanguage=es&specialty=medical
 * Or ?requestId=xxx to use that request's params.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  let sourceLanguage = searchParams.get('sourceLanguage') || 'en';
  let targetLanguage = searchParams.get('targetLanguage') || 'es';
  let specialty = searchParams.get('specialty') || 'medical';

  if (requestId) {
    const req = await prisma.interpretationRequest.findFirst({ where: { id: requestId } });
    if (req) {
      sourceLanguage = req.sourceLanguage;
      targetLanguage = req.targetLanguage;
      specialty = req.specialty;
    }
  }

  const allInterpreters = await prisma.user.findMany({
    where: { role: 'interpreter' },
    include: {
      interpreterProfile: true,
      interpreterAvailability: true,
    },
  });

  const debugReasons: { id: string; name: string; reason: string; raw?: unknown }[] = [];

  for (const u of allInterpreters) {
    const profile = u.interpreterProfile;
    const avail = u.interpreterAvailability;

    if (!profile) {
      debugReasons.push({ id: u.id, name: u.name, reason: 'No interpreter profile' });
      continue;
    }
    if (!avail) {
      debugReasons.push({ id: u.id, name: u.name, reason: 'No availability record' });
      continue;
    }
    if (avail.status !== 'online') {
      debugReasons.push({ id: u.id, name: u.name, reason: `Status is "${avail.status}" (need "online")` });
      continue;
    }

    const pairs = profile.languagePairs as LanguagePair[] | null | undefined;
    const specialties = profile.specialties as string[] | null | undefined;

    if (!Array.isArray(pairs) || pairs.length === 0) {
      debugReasons.push({
        id: u.id,
        name: u.name,
        reason: 'No language pairs',
        raw: { pairsType: typeof pairs, pairs },
      });
      continue;
    }
    if (!Array.isArray(specialties) || specialties.length === 0) {
      debugReasons.push({
        id: u.id,
        name: u.name,
        reason: 'No specialties',
        raw: { specialtiesType: typeof specialties, specialties },
      });
      continue;
    }

    const hasLang = pairs.some(
      (p) => String(p?.source) === sourceLanguage && String(p?.target) === targetLanguage
    );
    if (!hasLang) {
      debugReasons.push({
        id: u.id,
        name: u.name,
        reason: `Language pair mismatch: has ${JSON.stringify(pairs)}, need ${sourceLanguage}→${targetLanguage}`,
      });
      continue;
    }

    const hasSpecialty = specialties.includes(specialty) || specialties.includes('general');
    if (!hasSpecialty) {
      debugReasons.push({
        id: u.id,
        name: u.name,
        reason: `Specialty mismatch: has [${specialties.join(', ')}], need "${specialty}" or "general"`,
      });
      continue;
    }

    debugReasons.push({ id: u.id, name: u.name, reason: 'WOULD MATCH (checking active jobs...)' });
  }

  // Check active jobs - interpreters with active jobs are excluded
  const activeJobsByUser: Record<string, number> = {};
  const stuckJobsByUser: Record<string, { jobId: string; status: string; createdAt: string }[]> = {};
  for (const u of allInterpreters) {
    const jobs = await prisma.job.findMany({
      where: {
        assignedInterpreterId: u.id,
        status: { in: ['assigned', 'in_call'] },
      },
      select: { id: true, status: true, createdAt: true },
    });
    activeJobsByUser[u.id] = jobs.length;
    stuckJobsByUser[u.id] = jobs.map((j) => ({
      jobId: j.id,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    }));
  }

  const { interpreters, debug: matchingDebug } = await findEligibleInterpretersWithDebug({
    sourceLanguage,
    targetLanguage,
    specialty,
  });

  const socketAvailable = !!(global as { io?: unknown }).io;

  const finalReasons = debugReasons.map((r) => {
    if (r.reason.startsWith('WOULD MATCH')) {
      const active = activeJobsByUser[r.id] ?? 0;
      const stuck = stuckJobsByUser[r.id] ?? [];
      const excluded = active >= 1 && stuck[0]
        ? `EXCLUDED: has ${active} active job(s). To free: POST /api/admin/jobs/${stuck[0].jobId}/cancel (as admin)`
        : active >= 1
        ? `EXCLUDED: has ${active} active job(s)`
        : 'MATCHED';
      return { ...r, reason: r.reason, activeJobs: active, stuckJobs: stuck, excluded };
    }
    return r;
  });

  return NextResponse.json({
    socketAvailable,
    interpretersMatched: interpreters.length,
    matchedIds: interpreters.map((i) => ({ id: i.id, name: i.name })),
    matchingCounts: matchingDebug,
    debugReasons: finalReasons,
    activeJobsByUser,
    stuckJobsByUser,
    requestParams: { sourceLanguage, targetLanguage, specialty },
    requestId: requestId || undefined,
  });
}
