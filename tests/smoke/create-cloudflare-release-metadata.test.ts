import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReleaseMetadata } from '../../scripts/create-cloudflare-release-metadata.mjs';

const baseInput = {
  baseSha: 'base-sha',
  headSha: 'head-sha',
};

test('仅 DB schema 变更时标记 db_schema_changed，且仍为 normal release', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'src/config/db/schema.ts',
      'src/config/db/migrations/0001_init.sql',
    ],
    doMigrationChanged: false,
  });

  assert.equal(metadata.db_schema_changed, true);
  assert.equal(metadata.do_migration_changed, false);
  assert.equal(metadata.release_kind, 'normal');
});

test('仅 DO migration 变更时标记 migration release', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['wrangler.cloudflare.toml'],
    doMigrationChanged: true,
  });

  assert.equal(metadata.db_schema_changed, false);
  assert.equal(metadata.do_migration_changed, true);
  assert.equal(metadata.release_kind, 'migration');
});

test('仅普通 runtime 变更时保持 normal release', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['src/app/page.tsx'],
    doMigrationChanged: false,
  });

  assert.equal(metadata.db_schema_changed, false);
  assert.equal(metadata.do_migration_changed, false);
  assert.equal(metadata.release_kind, 'normal');
});

test('DO migration 仅配合 migration-safe 改动时允许作为 migration release', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'wrangler.cloudflare.toml',
      'cloudflare/workers/stateful-limiters.ts',
      'scripts/run-cf-migration-deploy.mjs',
      'tests/smoke/create-cloudflare-release-metadata.test.ts',
    ],
    doMigrationChanged: true,
  });

  assert.equal(metadata.release_kind, 'migration');
});

test('DO migration 配合 router 请求路径改动时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: ['wrangler.cloudflare.toml', 'cloudflare/workers/router.ts'],
        doMigrationChanged: true,
      }),
    /Durable Object migration changes must be released separately/i
  );
});

test('DO migration 配合 allowlist 外 runtime 改动时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: ['wrangler.cloudflare.toml', 'src/app/page.tsx'],
        doMigrationChanged: true,
      }),
    /Durable Object migration changes must be released separately/i
  );
});

test('schema 变更但缺少 DB migration 时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: ['src/config/db/schema.ts'],
        doMigrationChanged: false,
      }),
    /changed without any committed migration/i
  );
});
