/**
 * DB Schema Check (fail-fast)
 *
 * Usage:
 *   pnpm db:check
 *
 * Notes:
 * - This script reads DATABASE_URL and performs read-only checks.
 * - It does NOT apply migrations.
 */

import '@/config/load-dotenv';

import postgres from 'postgres';

import { assertRoleDeletedAtColumnExists } from '@/infra/adapters/db/schema-check';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 3,
  });

  try {
    await assertRoleDeletedAtColumnExists({
      sql,
      isProduction: process.env.NODE_ENV === 'production',
      logger: {
        error: (message, meta) => {
          console.error(message, meta);
        },
      },
    });
    console.log('db: schema check ok', { check: 'schema.role.deleted_at' });
  } finally {
    try {
      await sql.end?.({ timeout: 5 });
    } catch {
      // ignore cleanup errors
    }
  }
}

main().catch((error: unknown) => {
  console.error('db: schema check failed', { error });
  process.exitCode = 1;
});
