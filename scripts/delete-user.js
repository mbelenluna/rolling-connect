/**
 * Delete a user by email. Usage: node scripts/delete-user.js email@example.com
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const email = process.argv[2];
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/delete-user.js email@example.com');
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found:', email);
    process.exit(0);
  }

  // Unassign jobs
  await prisma.job.updateMany({
    where: { assignedInterpreterId: user.id },
    data: { assignedInterpreterId: null },
  });
  await prisma.goCardlessRedirectSession.deleteMany({
    where: { userId: user.id },
  });

  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted:', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
