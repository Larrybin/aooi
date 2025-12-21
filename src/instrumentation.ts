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
  const { assertRoleDeletedAtColumnExists } =
    await import('./core/db/schema-check');
  const { logger } = await import('./shared/lib/logger.server');

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 15,
  });

  try {
    await assertRoleDeletedAtColumnExists({
      sql,
      isProduction: true,
      logger,
    });
  } finally {
    try {
      await sql.end?.({ timeout: 5 });
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
