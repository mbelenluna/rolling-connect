import { prisma } from './prisma';

const STALE_MINUTES = 15;

export async function cancelJobAndRequest(jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId },
    include: { request: true },
  });
  if (!job) return false;

  await prisma.$transaction([
    prisma.job.update({ where: { id: jobId }, data: { status: 'canceled' } }),
    prisma.interpretationRequest.update({
      where: { id: job.requestId },
      data: { status: 'canceled' },
    }),
  ]);
  return true;
}

/**
 * Auto-cancel jobs stuck in "assigned" for too long (call never started).
 * Frees interpreters without needing admin.
 */
export async function cancelStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
  const stale = await prisma.job.findMany({
    where: {
      status: 'assigned',
      updatedAt: { lt: cutoff },
    },
  });
  for (const j of stale) {
    await cancelJobAndRequest(j.id);
  }
  return stale.length;
}
