import { prisma } from './src/lib/prisma';

async function main() {
  // Check if company exists
  let company = await prisma.company.findFirst();
  
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Kalwanga Lwanga Clothing',
        email: 'info@klc.com',
        phone: '1234567890',
        currency: 'USD',
        timezone: 'UTC',
        isActive: true,
      },
    });
    console.log('Company created:', company.id, '-', company.name);
  } else {
    console.log('Company exists:', company.id, '-', company.name);
  }

  // Create business unit
  const bu = await prisma.businessUnit.create({
    data: {
      name: 'Headquarters',
      code: 'KLC-HQ',
      isActive: true,
      companyId: company.id,
    },
  });
  console.log('Business Unit created:', bu.id, bu.name, bu.code);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
