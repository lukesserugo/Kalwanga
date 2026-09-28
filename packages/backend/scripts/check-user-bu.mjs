import { prisma } from '../src/lib/prisma.js';
const u = await prisma.user.findUnique({
  where: { email: 'lukesserugo09@gmail.com' },
  select: {
    id: true,
    email: true,
    businessUnits: {
      select: {
        id: true,
        businessUnitId: true,
        isActive: true,
        businessUnit: { select: { id: true, name: true } },
      },
    },
  },
});
console.log(JSON.stringify(u, null, 2));
await prisma.$disconnect();
