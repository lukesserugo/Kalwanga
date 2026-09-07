import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
datasource: {
    url: 'postgresql://postgres:Luke@localhost:5432/kalwanga?schema=public',
  },
});
