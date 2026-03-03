/**
 * Delete users by email. Run: node scripts/delete-users.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAILS = ['belen_luna_1801@hotmail.com', 'rolltranslations@gmail.com'];

async function main() {
  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`User not found: ${email}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.job.updateMany({
        where: { assignedInterpreterId: user.id },
        data: { assignedInterpreterId: null },
      });
      await tx.auditLog.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      });
      await tx.user.delete({ where: { id: user.id } });
    });

    console.log(`Deleted user: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
