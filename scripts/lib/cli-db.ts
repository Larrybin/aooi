import '@/config/load-dotenv';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export function createCliDb() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });

  return {
    db: drizzle(client),
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
