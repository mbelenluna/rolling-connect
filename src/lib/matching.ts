import { prisma } from './prisma';
import type { InterpretationRequest, InterpreterProfile, InterpreterAvailability } from '@prisma/client';

type LanguagePair = { source?: string; target?: string; sourceLanguage?: string; targetLanguage?: string; dialect?: string; proficiency?: string };

export async function findEligibleInterpreters(request: {
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  dialect?: string | null;
  certificationLevel?: string | null;
  yearsExperience?: number | null;
  securityClearance?: boolean;
  genderPreference?: string | null;
  scheduledAt?: Date | null;
}) {
  const now = request.scheduledAt || new Date();

  const interpreters = await prisma.user.findMany({
    where: {
      role: 'interpreter',
      approvedAt: { not: null },
      rejectedAt: null,
    },
    include: {
      interpreterProfile: true,
      interpreterAvailability: true,
    },
  });

  const eligible = interpreters.filter((u) => {
    const profile = u.interpreterProfile;
    const avail = u.interpreterAvailability;
    if (!profile || !avail) return false;
    if (avail.status !== 'online') return false;

    const pairs = profile.languagePairs as LanguagePair[];
    const specialties = profile.specialties as string[];
    if (!pairs?.length || !specialties?.length) return false;

    const hasLang = pairs.some((p) => {
      const src = (p?.source ?? p?.sourceLanguage ?? '').toString().toLowerCase();
      const tgt = (p?.target ?? p?.targetLanguage ?? '').toString().toLowerCase();
      return src === request.sourceLanguage.toLowerCase() && tgt === request.targetLanguage.toLowerCase();
    });
    if (!hasLang) return false;

    if (request.dialect) {
      const hasDialect = pairs.some((p) => p.dialect === request.dialect || !p.dialect);
      if (!hasDialect) return false;
    }

    const specMatch = specialties.some(
      (s) => String(s).toLowerCase() === request.specialty.toLowerCase() || String(s).toLowerCase() === 'general'
    );
    if (!specMatch) return false;

    if (request.certificationLevel) {
      const certs = profile.certifications as { level?: string }[];
      const hasCert = certs?.some((c) => c.level === request.certificationLevel);
      if (!hasCert) return false;
    }

    if (request.yearsExperience && (profile.yearsExperience ?? 0) < request.yearsExperience) return false;
    if (request.securityClearance && !profile.securityClearance) return false;
    if (request.genderPreference && profile.gender !== request.genderPreference) return false;

    return true;
  });

  const withActiveJobs = await Promise.all(
    eligible.map(async (u) => {
      const active = await prisma.job.count({
        where: {
          assignedInterpreterId: u.id,
          status: { in: ['assigned', 'in_call'] },
        },
      });
      const max = u.interpreterProfile?.maxConcurrentJobs ?? 1;
      return { user: u, canTake: active < max };
    })
  );

  return withActiveJobs.filter((x) => x.canTake).map((x) => x.user);
}
