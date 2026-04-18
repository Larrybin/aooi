import assert from 'node:assert/strict';
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
      DATABASE_URL:
        'postgresql://postgres:5jU*&RFTv&HQMYB@host:5432/postgres',
      AUTH_SPIKE_DATABASE_URL: 'postgresql://quoted',
    }
  );
});

test('injectCloudflareLocalSmokeDevVars 从 .dev.vars 补齐缺失变量且不覆盖显式传入值', () => {
  const processEnv = {
    DATABASE_URL: '',
    AUTH_SPIKE_DATABASE_URL: 'postgresql://explicit',
  };

  injectCloudflareLocalSmokeDevVars(processEnv, {
    devVarsPath: '/tmp/.dev.vars',
    readFileSyncImpl: () => `
DATABASE_URL=postgresql://from-dev-vars
AUTH_SPIKE_DATABASE_URL=postgresql://from-dev-vars-auth
`,
  });

  assert.deepEqual(processEnv, {
    DATABASE_URL: 'postgresql://from-dev-vars',
    AUTH_SPIKE_DATABASE_URL: 'postgresql://explicit',
  });
});

test('resolveLocalSmokeDatabaseUrl 优先 AUTH_SPIKE_DATABASE_URL，其次 DATABASE_URL', () => {
  assert.equal(
    resolveLocalSmokeDatabaseUrl({
      AUTH_SPIKE_DATABASE_URL: 'postgresql://auth-spike',
      DATABASE_URL: 'postgresql://database',
    }),
    'postgresql://auth-spike'
  );

  assert.equal(
    resolveLocalSmokeDatabaseUrl({
      DATABASE_URL: 'postgresql://database',
    }),
    'postgresql://database'
  );

  assert.equal(resolveLocalSmokeDatabaseUrl({}), '');
});

test('runCloudflareLocalSmoke 先等待 preview ready，再执行 app smoke，最后停止 topology', async () => {
  const steps: string[] = [];

  await runCloudflareLocalSmoke(
    {
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
          async stop() {
            steps.push('stop-topology');
          },
        };
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
