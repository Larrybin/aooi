import type postgres from 'postgres';

export type PostgresSqlClient = postgres.Sql;

export type SchemaCheckLogger = {
  error: (message: string, meta?: Record<string, unknown>) => void;
};

const MISSING_COLUMN = 'public.role.deleted_at';
const EXPECTED_MIGRATION = '0001_nasty_vindicator.sql';
const MIGRATIONS_DIR = 'src/config/db/migrations';
const MIGRATION_LOG_TABLE = '__drizzle_migrations';

function formatMessage(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

export function buildRoleDeletedAtMissingHint(): string {
  return formatMessage([
    `Database schema mismatch: missing column ${MISSING_COLUMN}.`,
    'This usually means migrations were not applied.',
    'Run: pnpm db:migrate',
    `Migrations directory: ${MIGRATIONS_DIR}`,
    `Migration log table (default): ${MIGRATION_LOG_TABLE}`,
  ]);
}

export function buildDatabaseConnectivityHint(cause: string): string {
  return formatMessage([
    'Database connectivity check failed.',
    'Verify DATABASE_URL, network access, and database credentials.',
    'Then apply migrations: pnpm db:migrate',
    `Cause: ${cause}`,
  ]);
}

export type PublicDatabaseMisconfigurationKind = 'connectivity' | 'schema';

function buildPublicDatabaseMisconfigurationMessage(
  kind: PublicDatabaseMisconfigurationKind
): string {
  switch (kind) {
    case 'connectivity':
      return formatMessage([
        'DB_STARTUP_CHECK_FAILED (connectivity): database check failed due to server misconfiguration.',
        'Verify DATABASE_URL, network access, and database credentials.',
        'See server logs for "db: connectivity check failed".',
      ]);
    case 'schema':
      return formatMessage([
        'DB_STARTUP_CHECK_FAILED (schema): database check failed due to server misconfiguration.',
        'Apply migrations: pnpm db:migrate',
        'See server logs for "db: schema mismatch detected".',
      ]);
  }
}

export function buildPublicDatabaseMisconfigurationError(
  kind: PublicDatabaseMisconfigurationKind
): Error {
  return new Error(buildPublicDatabaseMisconfigurationMessage(kind));
}

export function buildPublicPermissionMisconfigurationError(): Error {
  return new Error('permission check failed due to server misconfiguration');
}

export function isMissingRoleDeletedAtColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybe = error as { code?: unknown; message?: unknown };
  if (maybe.code !== '42703') return false;

  const message = typeof maybe.message === 'string' ? maybe.message : '';
  if (!message) return false;

  const normalized = message.toLowerCase().replaceAll('"', '');
  return (
    normalized.includes('role.deleted_at') &&
    normalized.includes('does not exist')
  );
}

async function hasRoleDeletedAtColumn(
  sql: PostgresSqlClient
): Promise<boolean> {
  const rows = await sql<{ ok: number }[]>`
    select 1 as ok
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'role'
      and column_name = 'deleted_at'
    limit 1
  `;

  return rows.length !== 0;
}

export async function assertRoleDeletedAtColumnExists(params: {
  sql: PostgresSqlClient;
  isProduction: boolean;
  logger: SchemaCheckLogger;
}): Promise<void> {
  const { sql, isProduction, logger } = params;

  let exists: boolean;
  try {
    exists = await hasRoleDeletedAtColumn(sql);
  } catch (error: unknown) {
    const detailed = new Error(
      buildDatabaseConnectivityHint(
        error instanceof Error ? error.message : String(error)
      )
    );

    logger.error('db: connectivity check failed', {
      check: 'schema.role.deleted_at',
      cause: error instanceof Error ? error.message : String(error),
      hint: detailed.message,
    });

    if (isProduction) {
      throw buildPublicDatabaseMisconfigurationError('connectivity');
    }
    throw detailed;
  }

  if (exists) return;

  const hint = buildRoleDeletedAtMissingHint();

  logger.error('db: schema mismatch detected', {
    check: 'schema.role.deleted_at',
    pgCode: '42703',
    missingColumn: MISSING_COLUMN,
    expectedMigration: EXPECTED_MIGRATION,
    migrationsDir: MIGRATIONS_DIR,
    migrationLogTable: MIGRATION_LOG_TABLE,
    hint,
  });

  if (isProduction) {
    throw buildPublicDatabaseMisconfigurationError('schema');
  }

  throw new Error(hint);
}
