import { prisma } from '../src/lib/prisma.js';
await prisma.user.update({
  where: { email: 'lukesserugo09@gmail.com' },
  data: { businessUnitId: 'cmu5f89ke0001wsc9kii72h7z' },
});
console.log('user.businessUnitId → Main Store');
await prisma.$disconnect();
