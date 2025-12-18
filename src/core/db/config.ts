import { defineConfig } from 'drizzle-kit';
import { createRequire } from 'node:module';

function loadDotenvForDrizzleKit() {
  try {
    const require = createRequire(import.meta.url);
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.development' });
    dotenv.config({ path: '.env', override: false });
  } catch {
    // optional
  }
}

loadDotenvForDrizzleKit();

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const databaseProvider = (process.env.DATABASE_PROVIDER ?? 'postgresql') as
  | 'sqlite'
  | 'postgresql'
  | 'mysql'
  | 'turso'
  | 'singlestore'
  | 'gel';

export default defineConfig({
  out: './src/config/db/migrations',
  schema: './src/config/db/schema.ts',
  dialect: databaseProvider,
  dbCredentials: {
    url: databaseUrl,
  },
});
