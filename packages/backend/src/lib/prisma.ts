// Option 1: Import from index.js (recommended)
import { PrismaClient } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Luke@localhost:5432/kalwanga?schema=public';

console.log('Database URL:', connectionString.replace(/:[^:@]*@/, ':****@'));

const pool = new Pool({
  connectionString: connectionString,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});

export default prisma;
