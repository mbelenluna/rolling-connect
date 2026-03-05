import { prisma } from './prisma';

type LanguagePair = { source?: string; target?: string; sourceLanguage?: string; targetLanguage?: string; dialect?: string; proficiency?: string };

export type MatchingDebugCounts = {
  totalInterpreters: number;
  approvedInterpreters: number;
  withProfile: number;
  withAvailability: number;
  statusOnline: number;
  languageMatch: number;
  specialtyMatch: number;
  notAtCapacity: number;
  finalEligible: number;
  filterReasons: { interpreterId: string; name: string; reason: string }[];
};

export async function findEligibleInterpretersWithDebug(request: {
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  dialect?: string | null;
  certificationLevel?: string | null;
  yearsExperience?: number | null;
  securityClearance?: boolean;
  genderPreference?: string | null;
  scheduledAt?: Date | null;
}): Promise<{ interpreters: Awaited<ReturnType<typeof findEligibleInterpreters>>; debug: MatchingDebugCounts }> {
  const filterReasons: { interpreterId: string; name: string; reason: string }[] = [];
  const now = request.scheduledAt || new Date();

  const allUsers = await prisma.user.findMany({
    where: { role: 'interpreter' },
    include: { interpreterProfile: true, interpreterAvailability: true },
  });
  const totalInterpreters = allUsers.length;

  const approved = allUsers.filter((u) => u.approvedAt != null && u.rejectedAt == null);
  const approvedInterpreters = approved.length;

  let withProfile = 0;
  let withAvailability = 0;
  let statusOnline = 0;
  let languageMatch = 0;
  let specialtyMatch = 0;

  const afterProfile = approved.filter((u) => {
    if (!u.interpreterProfile) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'No interpreter profile' });
      return false;
    }
    withProfile++;
    return true;
  });

  const afterAvail = afterProfile.filter((u) => {
    const avail = u.interpreterAvailability;
    if (!avail) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'No availability record' });
      return false;
    }
    withAvailability++;
    if (avail.status !== 'online') {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: `Status is "${avail.status}" (need "online")` });
      return false;
    }
    statusOnline++;
    return true;
  });

  const pairs = (u: typeof afterAvail[0]) => (u.interpreterProfile?.languagePairs as LanguagePair[]) || [];
  const specialties = (u: typeof afterAvail[0]) => (u.interpreterProfile?.specialties as string[]) || [];

  const afterLang = afterAvail.filter((u) => {
    const p = pairs(u);
    if (!p?.length) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'No language pairs' });
      return false;
    }
    const hasLang = p.some((pair) => {
      const src = (pair?.source ?? pair?.sourceLanguage ?? '').toString().toLowerCase();
      const tgt = (pair?.target ?? pair?.targetLanguage ?? '').toString().toLowerCase();
      return src === request.sourceLanguage.toLowerCase() && tgt === request.targetLanguage.toLowerCase();
    });
    if (!hasLang) {
      filterReasons.push({
        interpreterId: u.id,
        name: u.name,
        reason: `Language mismatch: need ${request.sourceLanguage}→${request.targetLanguage}, has ${JSON.stringify(p)}`,
      });
      return false;
    }
    languageMatch++;
    return true;
  });

  const afterSpec = afterLang.filter((u) => {
    const s = specialties(u);
    if (!s?.length) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'No specialties' });
      return false;
    }
    const specMatch = s.some(
      (x) => String(x).toLowerCase() === request.specialty.toLowerCase() || String(x).toLowerCase() === 'general'
    );
    if (!specMatch) {
      filterReasons.push({
        interpreterId: u.id,
        name: u.name,
        reason: `Specialty mismatch: need "${request.specialty}" or "general", has [${s.join(', ')}]`,
      });
      return false;
    }
    specialtyMatch++;
    return true;
  });

  const afterOther = afterSpec.filter((u) => {
    const profile = u.interpreterProfile!;
    if (request.dialect) {
      const p = pairs(u);
      const hasDialect = p.some((pair) => pair.dialect === request.dialect || !pair.dialect);
      if (!hasDialect) {
        filterReasons.push({ interpreterId: u.id, name: u.name, reason: `Dialect mismatch` });
        return false;
      }
    }
    if (request.certificationLevel) {
      const certs = (profile.certifications as { level?: string }[]) || [];
      const hasCert = certs.some((c) => c.level === request.certificationLevel);
      if (!hasCert) {
        filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'Certification level mismatch' });
        return false;
      }
    }
    if (request.yearsExperience && (profile.yearsExperience ?? 0) < request.yearsExperience!) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'Years experience too low' });
      return false;
    }
    if (request.securityClearance && !profile.securityClearance) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'No security clearance' });
      return false;
    }
    if (request.genderPreference && profile.gender !== request.genderPreference) {
      filterReasons.push({ interpreterId: u.id, name: u.name, reason: 'Gender preference mismatch' });
      return false;
    }
    return true;
  });

  const withActiveJobs = await Promise.all(
    afterOther.map(async (u) => {
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

  const final = withActiveJobs.filter((x) => x.canTake).map((x) => x.user);
  const notAtCapacity = final.length;

  for (const x of withActiveJobs) {
    if (!x.canTake) {
      filterReasons.push({
        interpreterId: x.user.id,
        name: x.user.name,
        reason: 'At max concurrent jobs',
      });
    }
  }

  const debug: MatchingDebugCounts = {
    totalInterpreters,
    approvedInterpreters,
    withProfile,
    withAvailability,
    statusOnline,
    languageMatch,
    specialtyMatch,
    notAtCapacity,
    finalEligible: final.length,
    filterReasons,
  };

  return { interpreters: final, debug };
}

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
