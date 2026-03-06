/**
 * Backfill phoneClientId for existing organizations that don't have one.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-client-ids.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_ID = 100000;
const MAX_ID = 999999;

function random6Digit(): string {
  const n = Math.floor(Math.random() * (MAX_ID - MIN_ID + 1)) + MIN_ID;
  return String(n);
}

async function generateUniqueId(existing: Set<string>): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const id = random6Digit();
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not generate unique ID');
}

async function main() {
  const existingIds = new Set(
    (await prisma.organization.findMany({ where: { phoneClientId: { not: null } }, select: { phoneClientId: true } }))
      .map((o) => o.phoneClientId!)
  );

  const orgsWithoutId = await prisma.organization.findMany({
    where: { phoneClientId: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${orgsWithoutId.length} organizations without Client ID`);

  for (const org of orgsWithoutId) {
    const id = await generateUniqueId(existingIds);
    existingIds.add(id);
    await prisma.organization.update({
      where: { id: org.id },
      data: { phoneClientId: id },
    });
    console.log(`Assigned Client ID ${id} to ${org.name}`);
  }

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
