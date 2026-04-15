import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveLocalSmokeDatabaseUrl,
  runCloudflareLocalSmoke,
} from '../../scripts/run-cf-local-smoke.mjs';

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
