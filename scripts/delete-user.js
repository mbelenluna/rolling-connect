const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const email = process.argv[2] || 'info@rolling-translations.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found:', email);
    await prisma.$disconnect();
    process.exit(0);
    return;
  }
  await prisma.job.updateMany({
    where: { assignedInterpreterId: user.id },
    data: { assignedInterpreterId: null },
  });
  await prisma.goCardlessRedirectSession.deleteMany({
    where: { userId: user.id },
  });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted', email);
  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
