import type { SchemaCheckLogger } from './core/db/schema-check';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export const runtime = 'nodejs';

function getAuthSecret(): string | null {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  return isNonEmptyString(secret) ? secret.trim() : null;
}

function formatConfigError(parts: string[]): Error {
  return new Error(parts.filter(Boolean).join(' '));
}

async function isOpenNextCloudflareRuntime(): Promise<boolean> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return !!env;
  } catch {
    return false;
  }
}

async function assertRoleDeletedAtColumnExists(
  databaseUrl: string,
  logger: SchemaCheckLogger
) {
  const postgres = (await import('postgres')).default;
  const { assertRoleDeletedAtColumnExists } =
    await import('./core/db/schema-check');

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 3,
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

  const { logger } = await import('./shared/lib/logger.server');

  const secret = getAuthSecret();
  if (!secret) {
    throw formatConfigError([
      'Auth config check failed in production: missing BETTER_AUTH_SECRET/AUTH_SECRET.',
      'Set one of these environment variables to a strong random value.',
    ]);
  }

  if (await isOpenNextCloudflareRuntime()) {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!isNonEmptyString(databaseUrl)) {
    const error = formatConfigError([
      'Database config check failed in production: missing DATABASE_URL.',
      'Set DATABASE_URL and apply migrations before starting the server.',
      'Run: pnpm db:migrate',
    ]);

    logger.error('instrumentation: db startup check failed', {
      hint: error.message,
    });
    return;
  }

  void assertRoleDeletedAtColumnExists(databaseUrl.trim(), logger).catch(
    (error: unknown) => {
      logger.error('instrumentation: db startup check failed', { error });
    }
  );
}
