import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReleaseMetadata,
  buildRevisionStateDeployInput,
  detectStateReleaseChange,
  hasStateMigrationChange,
  normalizeRevisionDeploySettings,
  normalizeRevisionSiteConfig,
  parseStateTemplateMigrations,
} from '../../scripts/create-cloudflare-release-metadata.mjs';

process.env.SITE = 'mamamiya';

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
    changedPaths: ['sites/mamamiya/deploy.settings.json'],
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

test('state template 变更会触发 state_changed', () => {
  assert.equal(
    detectStateReleaseChange(['cloudflare/wrangler.state.toml']),
    true
  );
});

test('site.config 变更会触发 state_changed', () => {
  assert.equal(
    detectStateReleaseChange(['sites/mamamiya/site.config.json']),
    true
  );
});

test('deploy.settings 变更会触发 state_changed', () => {
  assert.equal(
    detectStateReleaseChange(['sites/mamamiya/deploy.settings.json']),
    true
  );
});

test('state migration 仅配合 state-safe 改动时允许通过', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'sites/mamamiya/deploy.settings.json',
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

test('state migration 配合 state template 改动时允许通过', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'sites/mamamiya/deploy.settings.json',
      'cloudflare/wrangler.state.toml',
    ],
    stateChanged: true,
    stateMigrationsChanged: true,
  });

  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, true);
});

test('state migration 配合 router 请求路径改动时仍输出 state-first release metadata', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: [
      'sites/mamamiya/deploy.settings.json',
      'cloudflare/workers/router.ts',
    ],
    stateChanged: true,
    stateMigrationsChanged: true,
  });

  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, true);
});

test('state migration 配合 app runtime 改动时仍输出 state-first release metadata', () => {
  const metadata = buildReleaseMetadata({
    ...baseInput,
    changedPaths: ['sites/mamamiya/deploy.settings.json', 'src/app/page.tsx'],
    stateChanged: true,
    stateMigrationsChanged: true,
  });

  assert.equal(metadata.state_changed, true);
  assert.equal(metadata.state_migrations_changed, true);
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

test('state schemaVersion 变化会触发 state_migrations_changed', () => {
  assert.equal(
    hasStateMigrationChange(
      {
        stateWorker: {
          migrations: {
            tag: 'worker-state-v1',
            newSqliteClasses: ['ConfigDurableObject'],
          },
        },
      },
      {
        stateWorker: {
          migrations: {
            tag: 'worker-state-v2',
            newSqliteClasses: ['ConfigDurableObject'],
          },
        },
      }
    ),
    true
  );
});

test('state worker 名变化会触发 state_migrations_changed', () => {
  assert.equal(
    hasStateMigrationChange(
      {
        stateWorker: {
          migrations: {
            tag: 'worker-state-a-v1',
            newSqliteClasses: ['ConfigDurableObject'],
          },
        },
      },
      {
        stateWorker: {
          migrations: {
            tag: 'worker-state-b-v1',
            newSqliteClasses: ['ConfigDurableObject'],
          },
        },
      }
    ),
    true
  );
});

test('仅非 migration deploy 字段变化不会触发 state_migrations_changed', () => {
  const baseContract = {
    stateWorker: {
      migrations: {
        tag: 'worker-state-v1',
        newSqliteClasses: ['ConfigDurableObject'],
      },
    },
    route: {
      pattern: 'a.example.com',
    },
  };
  const headContract = {
    ...baseContract,
    route: {
      pattern: 'b.example.com',
    },
  };

  assert.equal(hasStateMigrationChange(baseContract, headContract), false);
});

test('历史 site.config 缺少 ai capability 时仍可归一化', () => {
  const normalized = normalizeRevisionSiteConfig(
    {
      key: 'mamamiya',
      brand: {
        appUrl: 'https://mamamiya.pdfreprinting.net',
      },
      capabilities: {
        auth: true,
        payment: 'none',
        docs: true,
        blog: true,
      },
      configVersion: 1,
    },
    {
      siteKey: 'mamamiya',
    }
  );

  assert.deepEqual(normalized, {
    key: 'mamamiya',
    brand: {
      appUrl: 'https://mamamiya.pdfreprinting.net',
    },
    capabilities: {
      ai: false,
    },
  });
});

test('旧平铺 deploy.settings 仍可提取 state migration 输入', () => {
  const normalized = normalizeRevisionDeploySettings({
    google_auth_enabled: false,
    github_auth_enabled: false,
    general_ai_enabled: false,
  });

  assert.deepEqual(normalized, {});
});

test('state template migration parser 提取历史 revision 的真实 migration tag', () => {
  const migrations = parseStateTemplateMigrations(`
name = "roller-rabbit-state"

[[migrations]]
tag = "cloudflare-state-v1"
new_sqlite_classes = [
  "DOQueueHandler",
  "DOShardedTagCache",
]
`);

  assert.deepEqual(migrations, {
    tag: 'cloudflare-state-v1',
    newSqliteClasses: ['DOQueueHandler', 'DOShardedTagCache'],
  });
});

test('revision normalizer 对旧 site/deploy/state-template 输入构造最小 state migration 比较对象', () => {
  const normalized = buildRevisionStateDeployInput({
    siteConfig: {
      key: 'mamamiya',
      brand: {
        appUrl: 'https://mamamiya.pdfreprinting.net',
      },
      capabilities: {
        auth: true,
        payment: 'none',
        docs: true,
        blog: true,
      },
      configVersion: 1,
    },
    deploySettings: {
      google_auth_enabled: false,
      github_auth_enabled: false,
      general_ai_enabled: false,
    },
    stateTemplate: `
name = "roller-rabbit-state"

[[migrations]]
tag = "cloudflare-state-v1"
new_sqlite_classes = [
  "DOQueueHandler",
  "DOShardedTagCache",
  "StatefulLimitersDurableObject",
]
`,
    siteKey: 'mamamiya',
  });

  assert.deepEqual(normalized, {
    siteKey: 'mamamiya',
    appUrl: 'https://mamamiya.pdfreprinting.net',
    aiEnabled: false,
    stateWorkerName: null,
    stateSchemaVersion: null,
    stateWorker: {
      migrations: {
        tag: 'cloudflare-state-v1',
        newSqliteClasses: [
          'DOQueueHandler',
          'DOShardedTagCache',
          'StatefulLimitersDurableObject',
        ],
      },
    },
  });
});
