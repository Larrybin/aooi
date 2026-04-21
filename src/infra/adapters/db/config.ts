import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'drizzle-kit';

import { getTrimmedEnvValue, isProductionEnv } from '@/config/env-contract';
import { assertPostgresOnlyDatabaseProvider } from '@/infra/runtime/database-provider';

function loadDotenvForDrizzleKit() {
  try {
    const isDev = !isProductionEnv();
    loadEnvConfig(process.cwd(), isDev);
  } catch {
    // optional
  }
}

loadDotenvForDrizzleKit();

const databaseUrl = getTrimmedEnvValue(undefined, 'DATABASE_URL') ?? '';
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

assertPostgresOnlyDatabaseProvider(
  getTrimmedEnvValue(undefined, 'DATABASE_PROVIDER')
);

export default defineConfig({
  out: './src/config/db/migrations',
  schema: './src/config/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
