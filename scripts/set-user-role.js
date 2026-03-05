const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'info@rolling-translations.com';
  const role = process.argv[3] || 'admin';
  await prisma.user.update({
    where: { email },
    data: { role },
  });
  console.log('Updated', email, 'to role:', role);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
