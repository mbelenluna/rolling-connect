/**
 * Reset (delete) test users by email. Use --dry-run to preview, --confirm to execute.
 * Usage: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/reset-test-users.ts [--dry-run] [--confirm] email1@example.com email2@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAILS = [
  'info@rolling-translations.com',
  'belen_luna:_1801@hotmail.com',
  'mariabelenluna18@gmail.com',
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  const emails = args.filter((a) => !a.startsWith('--') && a.includes('@'));

  const toDelete = emails.length > 0 ? emails : EMAILS;

  if (!dryRun && !confirm) {
    console.error('Usage: npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/reset-test-users.ts [--dry-run] [--confirm] [email1] [email2] ...');
    console.error('  --dry-run  Show what would be deleted (no changes)');
    console.error('  --confirm  Actually delete (required for changes)');
    console.error('  If no emails given, uses default list.');
    process.exit(1);
  }

  console.log(dryRun ? '[DRY RUN] Would delete:' : '[CONFIRM] Deleting:', toDelete.join(', '));

  const results: { email: string; deleted: boolean; error?: string }[] = [];

  for (const email of toDelete) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  ${email}: not found`);
      results.push({ email, deleted: false, error: 'not found' });
      continue;
    }

    if (dryRun) {
      const jobCount = await prisma.job.count({ where: { assignedInterpreterId: user.id } });
      const sessionCount = await prisma.goCardlessRedirectSession.count({ where: { userId: user.id } });
      console.log(`  ${email}: user ${user.id}, ${jobCount} jobs to unassign, ${sessionCount} redirect sessions`);
      results.push({ email, deleted: false });
      continue;
    }

    try {
      await prisma.job.updateMany({
        where: { assignedInterpreterId: user.id },
        data: { assignedInterpreterId: null },
      });
      await prisma.goCardlessRedirectSession.deleteMany({
        where: { userId: user.id },
      });
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`  ${email}: deleted`);
      results.push({ email, deleted: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ${email}: FAILED -`, msg);
      results.push({ email, deleted: false, error: msg });
    }
  }

  const deleted = results.filter((r) => r.deleted).length;
  const failed = results.filter((r) => !r.deleted && r.error && r.error !== 'not found').length;
  console.log(`\nDone: ${deleted} deleted, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
