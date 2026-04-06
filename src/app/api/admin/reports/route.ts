import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clientChargeCents, interpreterPayCentsWithRates } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/reports
 * Returns billing reports for clients and interpreters, grouped by month.
 * Query: ?clientId=&interpreterId=&month= (YYYY-MM)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId') || undefined;
  const interpreterId = searchParams.get('interpreterId') || undefined;
  const month = searchParams.get('month') || undefined;

  const [jobs, interpreterProfiles] = await Promise.all([
    prisma.job.findMany({
      where: { status: 'completed' },
      include: {
        request: {
          select: {
            id: true,
            targetLanguage: true,
            sourceLanguage: true,
            serviceType: true,
            scheduleType: true,
            specialty: true,
            interpretationType: true,
            costCenter: true,
            createdAt: true,
            createdByUserId: true,
            createdBy: { select: { id: true, name: true, email: true } },
          },
        },
        call: true,
        assignedInterpreter: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }),
    prisma.interpreterProfile.findMany({
      select: { userId: true, opiRateCents: true, vriRateCents: true },
    }),
  ]);

  // Build a map of interpreter userId → their rates
  const interpreterRateMap = new Map(
    interpreterProfiles.map((p) => [p.userId, { opiRateCents: p.opiRateCents, vriRateCents: p.vriRateCents }])
  );

  type CallRow = {
    id: string;
    requestId: string;
    date: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    interpreterId: string | null;
    interpreterName: string;
    interpreterEmail: string;
    languagePair: string;
    durationSeconds: number;
    durationMin: number;
    clientChargeCents: number;
    interpreterPayCents: number;
    monthKey: string;
    serviceType: string;
    scheduleType: string;
    costCenter: string;
  };

  const rows: CallRow[] = jobs
    .filter((j) => {
      const d = j.call?.billableDurationSeconds ?? j.call?.durationSeconds;
      return d != null && d > 0;
    })
    .map((j) => {
      const duration = j.call!.billableDurationSeconds ?? j.call!.durationSeconds ?? 0;
      const targetLang = j.request.targetLanguage;
      const dateIso = j.call?.endedAt ?? j.request.createdAt;
      const monthKey = new Date(dateIso).toISOString().slice(0, 7);
      return {
        id: j.id,
        requestId: j.requestId,
        date: new Date(dateIso).toISOString(),
        clientId: j.request.createdByUserId,
        clientName: j.request.createdBy?.name ?? '—',
        clientEmail: j.request.createdBy?.email ?? '—',
        interpreterId: j.assignedInterpreterId,
        interpreterName: j.assignedInterpreter?.name ?? '—',
        interpreterEmail: j.assignedInterpreter?.email ?? '—',
        languagePair: `${j.request.sourceLanguage} → ${j.request.targetLanguage}`,
        durationSeconds: duration,
        durationMin: Math.ceil(duration / 60),
        clientChargeCents: clientChargeCents(duration, targetLang, (j.request.interpretationType as 'human' | 'ai') ?? 'human'),
        interpreterPayCents: interpreterPayCentsWithRates(
          duration,
          j.request.serviceType,
          targetLang,
          j.assignedInterpreterId ? (interpreterRateMap.get(j.assignedInterpreterId)?.opiRateCents ?? null) : null,
          j.assignedInterpreterId ? (interpreterRateMap.get(j.assignedInterpreterId)?.vriRateCents ?? null) : null,
          (j.request.interpretationType as 'human' | 'ai') ?? 'human'
        ),
        monthKey,
        serviceType: j.request.serviceType,
        scheduleType: j.request.scheduleType,
        costCenter: j.request.costCenter ?? '',
      };
    });

  const clientsMap = new Map<string, { id: string; name: string; email: string }>();
  const interpretersMap = new Map<string, { id: string; name: string; email: string }>();
  for (const r of rows) {
    if (r.clientId) clientsMap.set(r.clientId, { id: r.clientId, name: r.clientName, email: r.clientEmail });
    if (r.interpreterId) interpretersMap.set(r.interpreterId, { id: r.interpreterId, name: r.interpreterName, email: r.interpreterEmail });
  }
  const clients = Array.from(clientsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const interpreters = Array.from(interpretersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const filteredRows = rows.filter(
    (r) =>
      (!clientId || r.clientId === clientId) &&
      (!interpreterId || r.interpreterId === interpreterId) &&
      (!month || r.monthKey === month)
  );

  const byMonth = filteredRows.reduce<Record<string, CallRow[]>>((acc, r) => {
    if (!acc[r.monthKey]) acc[r.monthKey] = [];
    acc[r.monthKey].push(r);
    return acc;
  }, {});

  const months = Object.keys(byMonth).sort().reverse();

  const result = {
    byMonth: months.map((m) => ({
      month: m,
      monthLabel: new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      calls: byMonth[m],
      totalClientChargeCents: byMonth[m].reduce((s, c) => s + c.clientChargeCents, 0),
      totalInterpreterPayCents: byMonth[m].reduce((s, c) => s + c.interpreterPayCents, 0),
      opiCount: byMonth[m].filter((c) => c.serviceType === 'OPI').length,
      vriCount: byMonth[m].filter((c) => c.serviceType === 'VRI').length,
      onDemandCount: byMonth[m].filter((c) => c.scheduleType === 'now').length,
      scheduledCount: byMonth[m].filter((c) => c.scheduleType === 'scheduled').length,
    })),
    clients,
    interpreters,
    summary: {
      totalCalls: filteredRows.length,
      opiCount: filteredRows.filter((r) => r.serviceType === 'OPI').length,
      vriCount: filteredRows.filter((r) => r.serviceType === 'VRI').length,
      onDemandCount: filteredRows.filter((r) => r.scheduleType === 'now').length,
      scheduledCount: filteredRows.filter((r) => r.scheduleType === 'scheduled').length,
    },
  };

  return NextResponse.json(result);
}
