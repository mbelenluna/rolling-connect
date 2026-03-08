/**
 * Billable interval tracking for OPI calls.
 * Billing only accrues when both client AND interpreter are connected.
 */
import { prisma } from './prisma';

const LOG_PREFIX = '[call-billing]';

/** Start a billable interval when interpreter joins (client already in conference). */
export async function startBillableInterval(callId: string): Promise<void> {
  try {
    await prisma.callBillableInterval.create({
      data: { callId, startedAt: new Date() },
    });
    console.log(LOG_PREFIX, 'Started interval', { callId });
  } catch (e) {
    console.error(LOG_PREFIX, 'startBillableInterval', e);
  }
}

/** End the current open billable interval when interpreter leaves. */
export async function endBillableInterval(callId: string): Promise<void> {
  try {
    const open = await prisma.callBillableInterval.findFirst({
      where: { callId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (open) {
      await prisma.callBillableInterval.update({
        where: { id: open.id },
        data: { endedAt: new Date() },
      });
      console.log(LOG_PREFIX, 'Ended interval', { callId, intervalId: open.id });
    }
  } catch (e) {
    console.error(LOG_PREFIX, 'endBillableInterval', e);
  }
}

/** Compute total billable seconds from all intervals. Closes any open interval at endAt. */
export async function finalizeBillableDuration(
  callId: string,
  endAt: Date
): Promise<number> {
  const intervals = await prisma.callBillableInterval.findMany({
    where: { callId },
    orderBy: { startedAt: 'asc' },
  });

  let totalSeconds = 0;
  for (const interval of intervals) {
    const end = interval.endedAt ?? endAt;
    const seconds = Math.max(0, Math.floor((end.getTime() - interval.startedAt.getTime()) / 1000));
    totalSeconds += seconds;
    if (!interval.endedAt) {
      await prisma.callBillableInterval.update({
        where: { id: interval.id },
        data: { endedAt: end },
      });
    }
  }

  return totalSeconds;
}
