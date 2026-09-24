import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: 'postgresql://postgres:Luke@localhost:5432/kalwanga?schema=public',
    shadowDatabaseUrl: 'postgresql://postgres:Luke@localhost:5432/kalwanga_shadow?schema=public',
  },
});
