/**
 * One-time script to cancel stale requests for the client test account.
 * Run: node scripts/clean-client-requests.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.user.findUnique({
    where: { email: 'client@example.com' },
  });
  if (!client) {
    console.log('Client test account not found.');
    return;
  }

  const stale = await prisma.interpretationRequest.findMany({
    where: {
      createdByUserId: client.id,
      status: { in: ['offered', 'assigned', 'in_call'] },
    },
    include: { jobs: true },
  });

  if (stale.length === 0) {
    console.log('No stale requests to clean.');
    return;
  }

  for (const req of stale) {
    const job = req.jobs.find((j) => ['offered', 'assigned', 'in_call'].includes(j.status));
    if (job) {
      await prisma.$transaction([
        prisma.job.update({ where: { id: job.id }, data: { status: 'canceled' } }),
        prisma.interpretationRequest.update({
          where: { id: req.id },
          data: { status: 'canceled' },
        }),
      ]);
      console.log(`Canceled request ${req.id} (was ${req.status})`);
    }
  }
  console.log(`Cleaned ${stale.length} stale request(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
