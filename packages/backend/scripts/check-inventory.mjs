import { prisma } from '../src/lib/prisma.js';

const ids = [
  'cmu5rrpr60000yoc9lezniruz',
  'cmu72l84x0005ywc9ac2gwjxq',
  'cmu5hdce50002e8c90juedy1r',
];

for (const id of ids) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      businessUnitId: true,
      inventoryId: true,
      inventory: {
        select: {
          id: true,
          quantity: true,
          reserved: true,
          available: true,
          businessUnitId: true,
        },
      },
    },
  });
  console.log(JSON.stringify(p, null, 2));
}

const orphanCount = await prisma.inventory.count({
  where: { product: null, variant: null },
});
console.log('Orphan inventory rows:', orphanCount);

await prisma.$disconnect();
