import { prisma } from '../src/lib/prisma.js';

const ids = [
  'cmu5rrpr60000yoc9lezniruz',
  'cmu72l84x0005ywc9ac2gwjxq',
  'cmu5hdce50002e8c90juedy1r',
];
const qty = 50;

for (const id of ids) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: { name: true, inventoryId: true, businessUnitId: true },
  });
  if (!p?.inventoryId) {
    console.log(`skip ${id}: no inventory link`);
    continue;
  }
  await prisma.inventory.update({
    where: { id: p.inventoryId },
    data: { quantity: qty, available: qty, reserved: 0 },
  });
  console.log(`seeded ${qty} for ${p.name} (BU ${p.businessUnitId})`);
}

await prisma.$disconnect();
