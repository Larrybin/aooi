import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runWithSite(args: string[], env: NodeJS.ProcessEnv = {}) {
  try {
    const result = await execFileAsync(
      process.execPath,
      ['scripts/run-with-site.mjs', ...args],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...env,
        },
      }
    );

    return {
      ok: true as const,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number;
    };

    return {
      ok: false as const,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      code: execError.code,
    };
  }
}

test('run-with-site 对 production 语义命令要求显式 SITE', async () => {
  const result = await runWithSite(['node', 'scripts/next-build.mjs'], {
    SITE: '',
  });

  assert.equal(result.ok, false);
  assert.match(result.stderr, /SITE is required for this command/);
  assert.match(result.stderr, /SITE=mamamiya/);
});

test('run-with-site 对 lint 使用内部 dev-local site fallback', async () => {
  const result = await runWithSite(
    ['node', '-p', 'process.env.SITE || ""'],
    {
      SITE: '',
    }
  );

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated dev-local/);
  assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'dev-local');
});

test('run-with-site 尊重显式 SITE', async () => {
  const result = await runWithSite(
    ['node', '-p', 'process.env.SITE || ""'],
    {
      SITE: 'mamamiya',
    }
  );

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated mamamiya/);
  assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'mamamiya');
});
