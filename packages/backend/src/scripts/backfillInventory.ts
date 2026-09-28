// src/scripts/backfillInventory.ts
import { prisma } from '../lib/prisma.js';
import { backfillInventoryForBusinessUnit } from '../lib/ensureInventory.js';

async function main() {
  const businessUnits = await prisma.businessUnit.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (businessUnits.length === 0) {
    console.log('No business units found — nothing to do.');
    return;
  }

  console.log(`Found ${businessUnits.length} business unit(s).\n`);

  let totalProducts = 0;
  let totalVariants = 0;
  let failedBUs = 0;

  for (const bu of businessUnits) {
    console.log(`🔄 Backfilling inventory for BU: ${bu.name} (${bu.id})`);

    try {
      const result = await prisma.$transaction(
        async (tx) => backfillInventoryForBusinessUnit(tx, bu.id),
        { timeout: 120_000 }, // big BUs can take a while inside one tx
      );
      totalProducts += result.products;
      totalVariants += result.variants;
      console.log(`   ✅ products processed: ${result.products}`);
      console.log(`   ✅ variants processed: ${result.variants}`);
    } catch (err) {
      failedBUs++;
      console.error(`   ❌ BU ${bu.name} failed:`, err);
      // Continue with the next BU rather than aborting the whole run.
    }
    console.log('');
  }

  console.log('✅ Backfill complete');
  console.log(`   BUs total:      ${businessUnits.length}`);
  console.log(`   BUs failed:     ${failedBUs}`);
  console.log(`   Products total: ${totalProducts}`);
  console.log(`   Variants total: ${totalVariants}`);

  if (failedBUs > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  