import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  injectCloudflareLocalSmokeDevVars,
  parseEnvFileContent,
  resolveLocalSmokeDatabaseUrl,
  runCloudflareLocalSmoke,
} from '../../scripts/run-cf-local-smoke.mjs';

test('parseEnvFileContent 解析 .dev.vars 键值并保留连接串特殊字符', () => {
  assert.deepEqual(
    parseEnvFileContent(`
# comment
DATABASE_URL=postgresql://postgres:5jU*&RFTv&HQMYB@host:5432/postgres
AUTH_SPIKE_DATABASE_URL="postgresql://quoted"
INVALID_LINE
    `),
    {
      DATABASE_URL: 'postgresql://postgres:5jU*&RFTv&HQMYB@host:5432/postgres',
      AUTH_SPIKE_DATABASE_URL: 'postgresql://quoted',
    }
  );
});

test('injectCloudflareLocalSmokeDevVars 只注入 allowlist 内变量且不覆盖显式传入值', () => {
  const processEnv = {
    AUTH_SECRET: '',
    BETTER_AUTH_SECRET: 'explicit-better-auth-secret',
  };

  injectCloudflareLocalSmokeDevVars(processEnv, {
    devVarsPath: '/tmp/.dev.vars',
    readFileSyncImpl: () => `
AUTH_SECRET=from-dev-vars-auth-secret
BETTER_AUTH_SECRET=from-dev-vars-better-auth-secret
NEXT_PUBLIC_APP_URL=http://127.0.0.1:8787
`,
  });

  assert.deepEqual(processEnv, {
    AUTH_SECRET: 'from-dev-vars-auth-secret',
    BETTER_AUTH_SECRET: 'explicit-better-auth-secret',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:8787',
  });
});

test('injectCloudflareLocalSmokeDevVars 拒绝 .dev.vars 中的数据库连接串', () => {
  assert.throws(
    () =>
      injectCloudflareLocalSmokeDevVars(
        {},
        {
          devVarsPath: '/tmp/.dev.vars',
          readFileSyncImpl: () => `
DATABASE_URL=postgresql://from-dev-vars
AUTH_SPIKE_DATABASE_URL=postgresql://from-dev-vars-auth
`,
        }
      ),
    /\.dev\.vars contains unsupported keys: AUTH_SPIKE_DATABASE_URL, DATABASE_URL/
  );
});

test('resolveLocalSmokeDatabaseUrl 优先 DATABASE_URL，其次 AUTH_SPIKE_DATABASE_URL', () => {
  assert.equal(
    resolveLocalSmokeDatabaseUrl({
      DATABASE_URL: 'postgresql://database',
      AUTH_SPIKE_DATABASE_URL: 'postgresql://auth-spike',
    }),
    'postgresql://database'
  );

  assert.equal(
    resolveLocalSmokeDatabaseUrl({
      AUTH_SPIKE_DATABASE_URL: 'postgresql://auth-spike',
    }),
    'postgresql://auth-spike'
  );

  assert.equal(resolveLocalSmokeDatabaseUrl({}), '');
});

test('runCloudflareLocalSmoke 先等待 preview ready，再执行 app smoke，最后停止 topology', async () => {
  const steps: string[] = [];

  await runCloudflareLocalSmoke(
    {
      templatePath: path.resolve(process.cwd(), 'wrangler.cloudflare.toml'),
      databaseUrl: 'postgresql://demo',
      baseUrl: 'http://127.0.0.1:8787',
    },
    {
      startCloudflareLocalDevTopologyImpl: async () => {
        steps.push('start-topology');
        return {
          getRouterBaseUrl() {
            steps.push('get-router-base-url');
            return 'http://127.0.0.1:9787';
          },
          getRecentLogs() {
            return '';
          },
          async stop() {
            steps.push('stop-topology');
          },
        } as never;
      },
      waitForPreviewReadyImpl: async ({ baseUrl }) => {
        steps.push(`wait-preview:${baseUrl}`);
      },
      runCloudflareAppSmokeImpl: async ({ baseUrl }) => {
        steps.push(`run-app-smoke:${baseUrl}`);
      },
    }
  );

  assert.deepEqual(steps, [
    'start-topology',
    'get-router-base-url',
    'wait-preview:http://127.0.0.1:9787',
    'run-app-smoke:http://127.0.0.1:9787',
    'stop-topology',
  ]);
});
