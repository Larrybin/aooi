import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMigrationDeployWranglerArgs,
  deployCloudflareMigration,
} from '../../scripts/run-cf-migration-deploy.mjs';

test('buildMigrationDeployWranglerArgs 固定使用 wrangler deploy 与 keep-vars', () => {
  const args = buildMigrationDeployWranglerArgs({
    configPath: '/tmp/wrangler.cloudflare.toml',
    secretsPath: '/tmp/cloudflare.secrets.env',
    message: 'migration-message',
  });

  assert.deepEqual(args, [
    'deploy',
    '--config',
    '/tmp/wrangler.cloudflare.toml',
    '--name',
    'roller-rabbit',
    '--message',
    'migration-message',
    '--keep-vars',
    '--secrets-file',
    '/tmp/cloudflare.secrets.env',
  ]);
  assert.equal(args.includes('versions'), false);
});

test('deployCloudflareMigration 只部署 router migration 并在成功后运行 smoke', async () => {
  const calls = [];
  let smokeCalled = false;
  let cleanedUp = false;

  await deployCloudflareMigration({
    async createArtifacts() {
      return {
        configPath: '/tmp/wrangler.cloudflare.toml',
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

test('deployCloudflareMigration 在 wrangler 失败时仍会 cleanup，且不会继续 smoke', async () => {
  let smokeCalled = false;
  let cleanedUp = false;

  await assert.rejects(
    deployCloudflareMigration({
      async createArtifacts() {
        return {
          configPath: '/tmp/wrangler.cloudflare.toml',
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
