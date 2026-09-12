// src/scripts/backfillInventory.ts
import { prisma } from '../lib/prisma.js';
import { backfillInventoryForBusinessUnit } from '../lib/ensureInventory.js';

async function main() {
  const businessUnits = await prisma.businessUnit.findMany({
    select: { id: true, name: true },
  });

  for (const bu of businessUnits) {
    console.log(`\n🔄 Backfilling inventory for BU: ${bu.name} (${bu.id})`);
    const result = await prisma.$transaction(async (tx) =>
      backfillInventoryForBusinessUnit(tx, bu.id)
    );
    console.log(`   ✅ products processed: ${result.products}`);
    console.log(`   ✅ variants processed: ${result.variants}`);
  }

  console.log('\n✅ Backfill complete');
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  