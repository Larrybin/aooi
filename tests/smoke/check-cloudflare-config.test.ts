import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const require = createRequire(import.meta.url);
const tsxLoader = require.resolve('tsx');
const storagePublicBaseUrlName = ['STORAGE', 'PUBLIC', 'BASE', 'URL'].join('_');
const forbiddenIdentityEnvName = ['NEXT_PUBLIC', 'APP', 'NAME'].join('_');
const appUrlEnvName = ['NEXT_PUBLIC', 'APP', 'URL'].join('_');

async function copyCloudflareConfigFixture(tempDir: string) {
  await mkdir(path.join(tempDir, 'cloudflare'), { recursive: true });
  await mkdir(path.join(tempDir, 'sites/mamamiya'), { recursive: true });

  const files = [
    'wrangler.cloudflare.toml',
    'cloudflare/wrangler.state.toml',
    'cloudflare/wrangler.server-public-web.toml',
    'cloudflare/wrangler.server-auth.toml',
    'cloudflare/wrangler.server-payment.toml',
    'cloudflare/wrangler.server-member.toml',
    'cloudflare/wrangler.server-chat.toml',
    'cloudflare/wrangler.server-admin.toml',
    'sites/mamamiya/site.config.json',
  ];

  for (const file of files) {
    await cp(path.join(rootDir, file), path.join(tempDir, file));
  }
}

async function withFixture(
  mutate: (tempDir: string) => Promise<void> | void = () => {}
) {
  await mkdir(os.tmpdir(), { recursive: true });
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'cf-check-fixture-'));

  await copyCloudflareConfigFixture(fixtureDir);
  await mutate(fixtureDir);

  return {
    fixtureDir,
    async cleanup() {
      await rm(fixtureDir, { recursive: true, force: true });
    },
  };
}

async function runCheckCloudflareConfig({
  cwd,
  env = {},
}: {
  cwd: string;
  env?: Record<string, string | undefined>;
}) {
  try {
    const result = await execFileAsync(
      process.execPath,
      [
        '--import',
        tsxLoader,
        '--eval',
        [
          `process.chdir(${JSON.stringify(cwd)});`,
          `await import(${JSON.stringify(pathToFileURL(path.join(rootDir, 'scripts/check-cloudflare-config.mjs')).href)});`,
        ].join(' '),
      ],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          SITE: 'mamamiya',
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

test('cf:check 缺少 storage public runtime binding 时失败', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({ cwd: fixture.fixtureDir });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /R2 public asset base URL/);
    assert.match(result.stderr, /runtime binding/);
    assert.match(result.stderr, /settings\/public-config/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 禁止 Cloudflare vars 回流站点 identity env', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const configPath = path.join(fixtureDir, 'wrangler.cloudflare.toml');
    const content = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      content.replace(
        `${appUrlEnvName} = "https://mamamiya.pdfreprinting.net/"`,
        [
          `${appUrlEnvName} = "https://mamamiya.pdfreprinting.net/"`,
          `${forbiddenIdentityEnvName} = "Roller Rabbit"`,
        ].join('\n')
      ),
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /is forbidden/);
    assert.match(result.stderr, /site identity must come from @\/site/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 要求 Cloudflare app URL 与默认站点 identity 同源', async () => {
  const fixture = await withFixture(async (fixtureDir) => {
    const configPath = path.join(fixtureDir, 'cloudflare/wrangler.server-auth.toml');
    const content = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      content.replace(
        `${appUrlEnvName} = "https://mamamiya.pdfreprinting.net/"`,
        `${appUrlEnvName} = "https://other.example.com/"`
      ),
      'utf8'
    );
  });

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.stderr, /must share the same origin/);
    assert.match(result.stderr, /site\.brand\.appUrl/);
  } finally {
    await fixture.cleanup();
  }
});

test('cf:check 接受显式 storage public runtime binding', async () => {
  const fixture = await withFixture();

  try {
    const result = await runCheckCloudflareConfig({
      cwd: fixture.fixtureDir,
      env: {
        [storagePublicBaseUrlName]: 'https://assets.example.com/',
      },
    });

    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /Cloudflare config structure looks good/);
  } finally {
    await fixture.cleanup();
  }
});
