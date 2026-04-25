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

test('run-with-site 对 Cloudflare smoke 命令要求显式 SITE', async () => {
  const result = await runWithSite(
    ['node', '--import', 'tsx', 'scripts/smoke.mjs', 'cf-local'],
    {
      SITE: '',
    }
  );

  assert.equal(result.ok, false);
  assert.match(result.stderr, /SITE is required for this command/);
  assert.match(result.stderr, /scripts\/smoke\.mjs cf-local/);
});

test('run-with-site 对 lint 使用内部 dev-local site fallback', async () => {
  const result = await runWithSite(
    [
      'node',
      '-p',
      '\'JSON.stringify({site: process.env.SITE || "", authSecret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "", storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || ""})\'',
    ],
    {
      SITE: '',
    }
  );

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated dev-local/);
  assert.equal(
    result.stdout.trimEnd().split('\n').at(-1),
    JSON.stringify({
      site: 'dev-local',
      authSecret: 'dev-local-auth-secret-dev-local-auth-secret',
      storagePublicBaseUrl: 'http://127.0.0.1:9787/assets/',
    })
  );
});

test('run-with-site 尊重显式 SITE', async () => {
  const result = await runWithSite(['node', '-p', 'process.env.SITE || ""'], {
    SITE: 'mamamiya',
  });

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated mamamiya/);
  assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'mamamiya');
});

test('run-with-site 对未知 SITE 输出可修复的配置错误', async () => {
  const result = await runWithSite(['node', '-p', 'process.env.SITE || ""'], {
    SITE: '__missing_site__',
  });

  assert.equal(result.ok, false);
  assert.match(result.stderr, /site "__missing_site__" is not configured/);
  assert.match(
    result.stderr,
    /missing sites\/__missing_site__\/site\.config\.json/
  );
  assert.match(result.stderr, /set SITE to one of: dev-local, mamamiya/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
  assert.doesNotMatch(result.stderr, /Error: site "__missing_site__"/);
  assert.doesNotMatch(result.stderr, /at readCurrentSiteConfig/);
});

test('run-with-site 对 release metadata 只生成 site module，不预生成 content source', async () => {
  const result = await runWithSite(
    [
      'node',
      'scripts/create-cloudflare-release-metadata.mjs',
      '--head-sha=HEAD',
      '--out=.tmp/test-release-metadata.json',
    ],
    {
      SITE: 'mamamiya',
    }
  );

  assert.equal(result.ok, true, result.stderr);
  assert.match(result.stdout, /\[site\] generated mamamiya/);
  assert.doesNotMatch(result.stdout, /\[content\] generated/);
});
