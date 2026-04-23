import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildStateDeployWranglerArgs,
  deployCloudflareState,
} from '../../scripts/run-cf-state-deploy.mjs';

test('package cf:deploy:state 只跑 state-scoped check 且不串完整 cf:build', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const command = manifest.scripts['cf:deploy:state'];

  assert.match(command, /check-cloudflare-config\.mjs --workers=state/);
  assert.doesNotMatch(command, /pnpm cf:check(?!-)/);
  assert.doesNotMatch(command, /pnpm cf:build/);
});

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
    '--experimental-autoconfig=false',
    '--keep-vars',
    '--secrets-file',
    '/tmp/cloudflare.secrets.env',
  ]);
  assert.equal(args.includes('versions'), false);
});

test('deployCloudflareState 只走 wrangler deploy 并在成功后 cleanup', async () => {
  const calls = [];
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
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'deploy');
  assert.equal(calls[0].includes('versions'), false);
  assert.equal(cleanedUp, true);
});

test('deployCloudflareState 在 wrangler 失败时仍会 cleanup', async () => {
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
    }),
    /deploy failed/
  );

  assert.equal(cleanedUp, true);
});
