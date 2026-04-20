import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReleaseMetadata } from '../../scripts/create-cloudflare-release-metadata.mjs';

const baseInput = {
  baseSha: 'base-sha',
  headSha: 'head-sha',
};

test('仅 DB schema 变更时标记 db_schema_changed，且不要求 state migration', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'src/config/db/schema.ts',
      'src/config/db/migrations/0001_init.sql',
    ],
    stateChanged: false,
    stateMigrationsChanged: false,
  });

  assert.equal(metadata.db_schema_changed, true);
  assert.equal(metadata.state_changed, false);
  assert.equal(metadata.state_migrations_changed, false);
});

test('仅 state migration 变更时同时标记 state_changed 与 state_migrations_changed', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['cloudflare/wrangler.state.toml'],
    stateChanged: true,
    stateMigrationsChanged: true,
  });

  assert.equal(metadata.db_schema_changed, false);
  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, true);
});

test('仅 state runtime 变更时标记 state_changed 但不标记 state_migrations_changed', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['cloudflare/workers/stateful-limiters.ts'],
    stateChanged: true,
    stateMigrationsChanged: false,
  });

  assert.equal(metadata.db_schema_changed, false);
  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, false);
});

test('仅普通 runtime 变更时保持 app-only 发布', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['src/app/page.tsx'],
    stateChanged: false,
    stateMigrationsChanged: false,
  });

  assert.equal(metadata.db_schema_changed, false);
  assert.equal(metadata.state_changed, false);
  assert.equal(metadata.state_migrations_changed, false);
});

test('state migration 仅配合 state-safe 改动时允许通过', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'cloudflare/wrangler.state.toml',
      'cloudflare/workers/state.ts',
      'cloudflare/workers/stateful-limiters.ts',
      'scripts/run-cf-state-deploy.mjs',
      'tests/smoke/create-cloudflare-release-metadata.test.ts',
    ],
    stateChanged: true,
    stateMigrationsChanged: true,
  });

  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, true);
});

test('state migration 配合 router 请求路径改动时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: [
          'cloudflare/wrangler.state.toml',
          'cloudflare/workers/router.ts',
        ],
        stateChanged: true,
        stateMigrationsChanged: true,
      }),
    /State Durable Object migration changes must be released separately/i
  );
});

test('state migration 配合 allowlist 外 runtime 改动时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: ['cloudflare/wrangler.state.toml', 'src/app/page.tsx'],
        stateChanged: true,
        stateMigrationsChanged: true,
      }),
    /State Durable Object migration changes must be released separately/i
  );
});

test('schema 变更但缺少 DB migration 时直接失败', () => {
  assert.throws(
    () =>
      buildReleaseMetadata({
        ...baseInput,
        changedPaths: ['src/config/db/schema.ts'],
        stateChanged: false,
        stateMigrationsChanged: false,
      }),
    /changed without any committed migration/i
  );
});
