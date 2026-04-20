import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStateDeployWranglerArgs,
  deployCloudflareState,
} from '../../scripts/run-cf-state-deploy.mjs';

test('buildStateDeployWranglerArgs 固定使用 wrangler deploy 与 keep-vars', () => {
  const args = buildStateDeployWranglerArgs({
    configPath: '/tmp/wrangler.state.toml',
    secretsPath: '/tmp/cloudflare.secrets.env',
    message: 'state-message',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/wrangler.state.toml',
    '--name',
    'roller-rabbit-state',
    '--message',
    'state-message',
    '--keep-vars',
    '--secrets-file',
    '/tmp/cloudflare.secrets.env',
  ]);
  assert.equal(args.includes('versions'), false);
});

test('deployCloudflareState 只走 wrangler deploy 并在成功后运行 smoke', async () => {
  const calls = [];
  let smokeCalled = false;
  let cleanedUp = false;

  await deployCloudflareState({
    async createArtifacts() {
      return {
        configPath: '/tmp/wrangler.state.toml',
        secretsPath: '/tmp/cloudflare.secrets.env',
        async cleanup() {
          cleanedUp = true;
        },
      };
    },
    async runWranglerCommand(args) {
      calls.push(args);
      return { stdout: '', stderr: '' };
    },
    async runSmoke() {
      smokeCalled = true;
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'deploy');
  assert.equal(calls[0].includes('versions'), false);
  assert.equal(smokeCalled, true);
  assert.equal(cleanedUp, true);
});

test('deployCloudflareState 在 wrangler 失败时仍会 cleanup，且不会继续 smoke', async () => {
  let smokeCalled = false;
  let cleanedUp = false;

  await assert.rejects(
    deployCloudflareState({
      async createArtifacts() {
        return {
          configPath: '/tmp/wrangler.state.toml',
          secretsPath: '/tmp/cloudflare.secrets.env',
          async cleanup() {
            cleanedUp = true;
          },
        };
      },
      async runWranglerCommand() {
        throw new Error('deploy failed');
      },
      async runSmoke() {
        smokeCalled = true;
      },
    }),
    /deploy failed/
  );

  assert.equal(smokeCalled, false);
  assert.equal(cleanedUp, true);
});
