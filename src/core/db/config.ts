import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

import { assertPostgresOnlyDatabaseProvider } from './postgres-only';

function loadDotenvForDrizzleKit() {
  try {
    const isDev = process.env.NODE_ENV !== 'production';
    loadEnvConfig(process.cwd(), isDev);
  } catch {
    // optional
  }
}

loadDotenvForDrizzleKit();

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

assertPostgresOnlyDatabaseProvider(process.env.DATABASE_PROVIDER);

export default defineConfig({
  out: './src/config/db/migrations',
  schema: './src/config/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
