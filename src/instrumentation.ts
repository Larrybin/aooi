function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getAuthSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  return isNonEmptyString(secret) ? secret.trim() : null;
}

function formatConfigError(parts: string[]): Error {
  return new Error(parts.filter(Boolean).join(' '));
}

async function assertRoleDeletedAtColumnExists(databaseUrl: string) {
  const postgres = (await import('postgres')).default;
  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 5,
  });

  try {
    let rows: { length: number };
    try {
      rows = (await sql`
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'role'
          and column_name = 'deleted_at'
        limit 1
      `) as unknown as { length: number };
    } catch (error: unknown) {
      throw formatConfigError([
        'Database connectivity check failed in production.',
        'Verify DATABASE_URL, network access, and database credentials.',
        'Then apply migrations: pnpm db:migrate',
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }

    if (rows.length === 0) {
      throw formatConfigError([
        'Database schema check failed in production: missing column public.role.deleted_at.',
        'This usually means migrations were not applied.',
        'Run: pnpm db:migrate',
        'Expected migration: src/config/db/migrations/0001_nasty_vindicator.sql',
        'Migrations directory: src/config/db/migrations',
        'Migration log table (default): __drizzle_migrations',
      ]);
    }
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function register() {
  const runtime = process.env.NEXT_RUNTIME;
  if (runtime === 'edge') {
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return;
  }

  const secret = getAuthSecret();
  if (!secret) {
    throw formatConfigError([
      'Auth config check failed in production: missing BETTER_AUTH_SECRET/AUTH_SECRET.',
      'Set one of these environment variables to a strong random value.',
    ]);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!isNonEmptyString(databaseUrl)) {
    throw formatConfigError([
      'Database config check failed in production: missing DATABASE_URL.',
      'Set DATABASE_URL and apply migrations before starting the server.',
      'Run: pnpm db:migrate',
    ]);
  }

  await assertRoleDeletedAtColumnExists(databaseUrl.trim());
}
