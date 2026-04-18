import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SMOKE_SCENARIOS,
  getSmokeScenarioCommand,
} from '../../scripts/smoke.mjs';

test('smoke runner: public scenarios map to existing runner scripts', () => {
  assert.deepEqual(Object.keys(SMOKE_SCENARIOS).sort(), [
    'auth-spike',
    'cf-admin-settings',
    'cf-app',
    'cf-local',
  ]);

  assert.equal(SMOKE_SCENARIOS['auth-spike'].script, 'scripts/run-auth-spike.mjs');
  assert.equal(SMOKE_SCENARIOS['cf-app'].script, 'scripts/run-cf-app-smoke.mjs');
  assert.equal(
    SMOKE_SCENARIOS['cf-admin-settings'].script,
    'scripts/run-cf-admin-settings-smoke.mjs'
  );
  assert.equal(
    SMOKE_SCENARIOS['cf-local'].script,
    'scripts/run-cf-local-smoke.mjs'
  );
});

test('smoke runner: scenario command keeps tsx loader for TS imports', () => {
  const command = getSmokeScenarioCommand('cf-app', {
    nodePath: '/usr/local/bin/node',
  });

  assert.equal(command.command, '/usr/local/bin/node');
  assert.deepEqual(command.args.slice(0, 2), ['--import', 'tsx']);
  assert.equal(command.args.at(-1)?.endsWith('scripts/run-cf-app-smoke.mjs'), true);
});

test('package scripts: public smoke command names stay stable', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(
    packageJson.scripts['test:auth-spike'],
    'node --import tsx scripts/smoke.mjs auth-spike'
  );
  assert.equal(
    packageJson.scripts['test:cf-app-smoke'],
    'node --import tsx scripts/smoke.mjs cf-app'
  );
  assert.equal(
    packageJson.scripts['test:cf-local-smoke'],
    'node --import tsx scripts/smoke.mjs cf-local'
  );
  assert.equal(
    packageJson.scripts['test:cf-admin-settings-smoke'],
    'pnpm cf:build && node --import tsx scripts/smoke.mjs cf-admin-settings'
  );
});
