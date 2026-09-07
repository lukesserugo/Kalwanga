import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Create adapter
const adapter = new PrismaPg({ 
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Luke@localhost:5432/kalwanga?schema=public' 
});

// Create Prisma client with adapter
const prisma = new PrismaClient({ adapter });

const categories = [
  { name: 'Electronics', description: 'Latest gadgets and electronic devices' },
  { name: 'Clothing', description: 'Fashion for all seasons' },
  { name: 'Books', description: 'Knowledge and entertainment' },
  { name: 'Home & Garden', description: 'Make your home beautiful' },
  { name: 'Sports', description: 'Gear for every sport' },
  { name: 'Toys', description: 'Fun for all ages' },
  { name: 'Beauty', description: 'Look and feel your best' },
  { name: 'Food & Beverage', description: 'Delicious treats' },
];

const productNames = [
  // Electronics
  'Wireless Bluetooth Earbuds',
  'Smart Watch Series 5',
  'USB-C Hub Adapter',
  'Portable Power Bank 20000mAh',
  'Wireless Charging Pad',
  'HD Webcam 1080p',
  'Gaming Headset with Mic',
  'Bluetooth Speaker Portable',
  'External Hard Drive 1TB',
  'USB Flash Drive 64GB',
  'Laptop Stand Ergonomic',
  'Cable Management Kit',
  'Screen Protector Glass',
  'Phone Case Shockproof',
  
  // Clothing
  'Cotton T-Shirt Classic',
  'Denim Jeans Slim Fit',
  'Hoodie Fleece Warm',
  'Running Shoes Men',
  'Sneakers Women',
  'Leather Jacket Black',
  'Scarf Winter Warm',
  'Beanie Hat Knitted',
  'Socks Pack 5 Pairs',
  'Belt Leather Brown',
  'Backpack Travel Large',
  'Sunglasses Polarized',
  'Watch Leather Strap',
  'Wallet RFID Blocking',
  
  // Books
  'The Art of Programming',
  'Design Patterns Explained',
  'Clean Code Handbook',
  'JavaScript: The Good Parts',
  'Python Crash Course',
  'Data Science for Beginners',
  'Web Development Guide',
  'Machine Learning Basics',
  'Digital Marketing Mastery',
  'Business Strategy 101',
  'Personal Finance Guide',
  'Meditation for Beginners',
  'Cooking Recipes Collection',
  'Travel Photography Tips',
  
  // Home & Garden
  'Indoor Plant Set 3 Pack',
  'LED String Lights',
  'Decorative Throw Pillow',
  'Kitchen Utensil Set',
  'Non-Stick Frying Pan',
  'Ceramic Coffee Mug Set',
  'Glass Storage Containers',
  'Bamboo Cutting Board',
  'Herb Garden Kit',
  'Bird Feeder Outdoor',
  'Garden Tool Set',
  'Outdoor Plant Pots',
  'Fairy Garden Accessories',
  'Wind Chimes Decorative',
  
  // Sports
  'Yoga Mat Premium',
  'Dumbbell Set 5kg',
  'Resistance Bands Kit',
  'Jump Rope Adjustable',
  'Fitness Tracker Band',
  'Water Bottle Sports',
  'Gym Bag Large',
  'Foam Roller Massage',
  'Pull Up Bar Doorway',
  'Exercise Ball Anti-Burst',
  'Running Belt Waist',
  'Sports Headband Sweat',
  'Ankle Weights Set',
  'Pilates Ring Circle',
  
  // Toys
  'Building Blocks 100 Pcs',
  'Remote Control Car',
  'Doll Set Princess',
  'Action Figure Hero',
  'Board Game Strategy',
  'Puzzle 1000 Pieces',
  'Art Set 50 Colors',
  'Educational Toy ABC',
  'Musical Instrument Set',
  'Science Experiment Kit',
  'Play-Doh Creative Set',
  'Robot Building Kit',
  'Train Set Electric',
  'Kitchen Playset',
  
  // Beauty
  'Facial Cleanser Organic',
  'Moisturizer Cream Day',
  'Night Serum Anti-Aging',
  'Sunscreen SPF 50',
  'Makeup Brush Set',
  'Lipstick Set 12 Colors',
  'Nail Polish Kit',
  'Face Mask Sheet 10 Pack',
  'Eye Cream Firming',
  'Body Lotion Hydrating',
  'Hair Oil Treatment',
  'Shampoo Bar Natural',
  'Beauty Sponge Blender',
  'Makeup Remover Wipes',
  
  // Food & Beverage
  'Coffee Beans Organic',
  'Green Tea Matcha',
  'Honey Raw Pure',
  'Olive Oil Extra Virgin',
  'Spices Gift Set',
  'Chocolate Box Premium',
  'Snack Variety Pack',
  'Protein Bars 12 Pack',
  'Smoothie Mix Berry',
  'Granola Oats Healthy',
  'Herbal Tea Sampler',
  'Almond Milk Unsweetened',
  'Coconut Water Hydrating',
  'Energy Drink Natural',
];

const descriptions = [
  'High-quality product designed for everyday use. Built with premium materials and attention to detail.',
  'Innovative and reliable, this product delivers exceptional performance and value.',
  'Perfect for both beginners and professionals. Comes with a satisfaction guarantee.',
  'A must-have item for anyone looking to upgrade their lifestyle. Durable and stylish.',
  'Experience the difference with this top-rated product. Loved by thousands of customers.',
  'Compact, efficient, and easy to use. The ideal choice for modern living.',
  'Premium quality at an affordable price. This product sets a new standard in its category.',
  'Designed with the user in mind. Features include intuitive controls and long-lasting durability.',
  'The ultimate solution for your needs. Combines functionality with elegant design.',
  'Trusted by experts and recommended by professionals. A reliable choice you can count on.',
];

const skuPrefixes = ['ELEC', 'CLOTH', 'BOOK', 'HOME', 'SPORT', 'TOYS', 'BEAUTY', 'FOOD'];

const getRandomItem = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

async function main() {
  try {
    console.log('🌱 Starting database seeding...');

    // Get or create admin user
    let adminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    let businessUnit = await prisma.businessUnit.findFirst();

    // If no admin user or business unit exists, create them
    if (!adminUser || !businessUnit) {
      console.log('📝 Creating default admin user and business unit...');
      
      // Create company
      const company = await prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'admin@company.com',
          phone: '+1234567890',
          currency: 'USD',
          timezone: 'UTC',
          isActive: true,
        },
      });

      // Create business unit
      businessUnit = await prisma.businessUnit.create({
        data: {
          name: 'Main Store',
          code: 'MAIN',
          companyId: company.id,
          isActive: true,
        },
      });

      // Create admin user
      adminUser = await prisma.user.create({
        data: {
          clerkId: 'admin_clerk_id',
          email: 'admin@pos-system.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'SUPER_ADMIN',
          isActive: true,
          companyId: company.id,
        },
      });

      // Create business unit user relationship
      await prisma.businessUnitUser.create({
        data: {
          userId: adminUser.id,
          businessUnitId: businessUnit.id,
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      console.log('✅ Created default admin user and business unit');
    }

    console.log(`✅ Admin user: ${adminUser.email}`);
    console.log(`✅ Business unit: ${businessUnit.name}`);

    // Create categories
    console.log('📁 Creating categories...');
    const createdCategories = [];
    for (const category of categories) {
      const created = await prisma.category.create({
        data: {
          name: category.name,
          description: category.description,
          businessUnitId: businessUnit.id,
          isActive: true,
        },
      });
      createdCategories.push(created);
      console.log(`  ✅ Created category: ${category.name}`);
    }

    // Create products
    console.log('📦 Creating products...');
    const products = [];

    for (let i = 0; i < 30; i++) {
      const category = getRandomItem(createdCategories);
      const name = getRandomItem(productNames);
      const skuPrefix = skuPrefixes[createdCategories.indexOf(category)] || 'GEN';
      const sku = `${skuPrefix}-${String(i + 1).padStart(4, '0')}`;
      const price = getRandomNumber(10, 500);
      const stock = getRandomNumber(0, 100);
      const images = [
        `https://picsum.photos/seed/${i + 1}/400/400`,
        `https://picsum.photos/seed/${i + 100}/400/400`,
      ];

      const product = await prisma.product.create({
        data: {
          name: name,
          description: getRandomItem(descriptions),
          sku: sku,
          unitPrice: price,
          costPrice: Math.round(price * 0.6 * 100) / 100,
          taxRate: getRandomNumber(5, 20),
          minStock: getRandomNumber(5, 20),
          maxStock: getRandomNumber(50, 200),
          isActive: true,
          images: images,
          categoryId: category.id,
          businessUnitId: businessUnit.id,
          createdBy: adminUser.id,
          updatedBy: adminUser.id,
          attributes: {
            material: getRandomItem(['Plastic', 'Metal', 'Wood', 'Glass', 'Fabric', 'Rubber']),
            color: getRandomItem(['Red', 'Blue', 'Green', 'Black', 'White', 'Silver', 'Gold']),
            weight: `${getRandomNumber(1, 50)}g`,
            dimensions: `${getRandomNumber(10, 50)}x${getRandomNumber(10, 50)}x${getRandomNumber(5, 20)}cm`,
          },
        },
      });

      // Create inventory
      await prisma.inventory.create({
        data: {
          productId: product.id,
          businessUnitId: businessUnit.id,
          quantity: stock,
          reserved: 0,
          reorderPoint: getRandomNumber(5, 15),
          reorderQuantity: getRandomNumber(10, 30),
          location: getRandomItem(['Warehouse A', 'Warehouse B', 'Warehouse C', 'Store Front']),
          supplier: getRandomItem(['Tech Supply Co', 'Global Imports', 'Local Distributors', 'Premium Suppliers']),
          status: 'ACTIVE',
        },
      });

      products.push(product);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  ✅ Created ${i + 1} products...`);
      }
    }

    console.log(`✅ Created ${products.length} products!`);

    // Create some featured products
    console.log('⭐ Creating featured products...');
    const featuredProducts = products.slice(0, 8);
    for (const product of featuredProducts) {
      await prisma.product.update({
        where: { id: product.id },
        data: {
          attributes: {
            ...(product.attributes as any),
            featured: true,
          },
        },
      });
    }
    console.log(`✅ Created ${featuredProducts.length} featured products!`);

    console.log('🎉 Database seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`  - Categories: ${createdCategories.length}`);
    console.log(`  - Products: ${products.length}`);
    console.log(`  - Featured Products: ${featuredProducts.length}`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('📡 Database disconnected');
  });
  