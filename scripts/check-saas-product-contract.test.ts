import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'check-saas-product-contract.mjs'
);

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, 'utf8');
}

async function createFixtureRoot(pricing: unknown) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'saas-contract-audit-'));
  const siteKey = 'ai-remover';
  await writeJson(path.join(rootDir, 'sites', siteKey, 'site.config.json'), {
    key: siteKey,
    domain: 'airemover.example.com',
    brand: {
      appName: 'AI Remover',
      appUrl: 'https://airemover.example.com',
      supportEmail: 'support@airemover.example.com',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      previewImage: '/logo.png',
    },
    capabilities: {
      auth: true,
      payment: 'creem',
      ai: true,
      docs: false,
      blog: false,
    },
    configVersion: 1,
  });
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
    {
      configVersion: 1,
      bindingRequirements: {
        bindings: { workersAi: true },
        secrets: {
          authSharedSecret: true,
          googleOauth: true,
          githubOauth: false,
          removerCleanup: true,
        },
        vars: { storagePublicBaseUrl: true },
      },
      workers: {
        router: 'aooi-ai-remover-router',
        state: 'aooi-ai-remover-state',
        'public-web': 'aooi-ai-remover-public-web',
        auth: 'aooi-ai-remover-auth',
        payment: 'aooi-ai-remover-payment',
        member: 'aooi-ai-remover-member',
        chat: 'aooi-ai-remover-chat',
        admin: 'aooi-ai-remover-admin',
      },
      resources: {
        incrementalCacheBucket: 'aooi-ai-remover-opennext-cache',
        appStorageBucket: 'aooi-ai-remover-storage',
        hyperdriveId: '00000000000000000000000000000002',
      },
      state: { schemaVersion: 1 },
    }
  );
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'pricing.json'),
    pricing
  );
  await writeText(
    path.join(rootDir, 'src/domains/settings/definitions/payment.ts'),
    "export const paymentSettings = [{ name: 'creem_product_ids' }];\n"
  );
  await writeText(
    path.join(rootDir, 'src/config/env-contract.ts'),
    [
      'export const SERVER_RUNTIME_ENV_KEYS = [',
      "  'CREEM_API_KEY',",
      "  'CREEM_SIGNING_SECRET',",
      "  'BETTER_AUTH_SECRET',",
      "  'AUTH_SECRET',",
      "  'GOOGLE_CLIENT_ID',",
      "  'GOOGLE_CLIENT_SECRET',",
      "  'GITHUB_CLIENT_ID',",
      "  'GITHUB_CLIENT_SECRET',",
      "  'STORAGE_PUBLIC_BASE_URL',",
      "  'REMOVER_CLEANUP_SECRET',",
      '];',
      '',
    ].join('\n')
  );
  return rootDir;
}

function runAudit(rootDir: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: rootDir,
    env: {
      ...process.env,
      SITE: 'ai-remover',
    },
    encoding: 'utf8',
  });
}

test('contract audit warnings include source refs', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            raw_daily_limit: 2,
            low_res_download: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /warning  Raw entitlement key raw_daily_limit/);
  assert.match(
    result.stdout,
    /source  pricing:sites\/ai-remover\/pricing\.json:entitlements\.raw_daily_limit/
  );
});

test('contract audit converts pricing validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          product_id: 'pro-monthly',
          interval: 'month',
          amount: '999',
          currency: 'USD',
          checkout_enabled: true,
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(result.stdout, /Pricing file: invalid/);
  assert.match(
    result.stdout,
    /blocker  Pricing file could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  pricing:sites\/ai-remover\/pricing\.json/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit converts deploy settings validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeJson(
    path.join(rootDir, 'sites', 'ai-remover', 'deploy.settings.json'),
    { configVersion: 1 }
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(
    result.stdout,
    /blocker  Deploy settings could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  deploy_settings:sites\/ai-remover\/deploy\.settings\.json/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit detects creem product mapping setting structurally', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Pro',
          product_id: 'pro-monthly',
          interval: 'month',
          amount: 999,
          currency: 'USD',
          checkout_enabled: true,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeText(
    path.join(rootDir, 'src/domains/settings/definitions/payment.ts'),
    [
      'export const paymentSettings = [',
      '  {',
      '    name : "creem_product_ids",',
      '  },',
      '];',
      '',
    ].join('\n')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /payment provider product mapping: runtime_owned/
  );
  assert.doesNotMatch(
    result.stdout,
    /Paid checkout plan pro-monthly has no payment product mapping path/
  );
});

test('contract audit validates payment secret ownership from env contract sources', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeText(
    path.join(rootDir, 'src/config/env-contract.ts'),
    [
      'export const SERVER_RUNTIME_ENV_KEYS = [',
      "  'BETTER_AUTH_SECRET',",
      "  'AUTH_SECRET',",
      "  'GOOGLE_CLIENT_ID',",
      "  'GOOGLE_CLIENT_SECRET',",
      "  'STORAGE_PUBLIC_BASE_URL',",
      "  'REMOVER_CLEANUP_SECRET',",
      '];',
      '',
    ].join('\n')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /payment provider secrets: missing/);
  assert.match(
    result.stdout,
    /warning  Runtime-owned field payment provider secrets has no configured owner/
  );
  assert.match(
    result.stdout,
    /source  runtime_env:src\/config\/env-contract\.ts:CREEM_API_KEY/
  );
  assert.match(
    result.stdout,
    /source  runtime_env:src\/config\/env-contract\.ts:CREEM_SIGNING_SECRET/
  );
});

test('contract audit converts site config validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeJson(
    path.join(rootDir, 'sites', 'ai-remover', 'site.config.json'),
    {
      key: 'ai-remover',
      domain: 'airemover.example.com',
      brand: {
        appName: 'AI Remover',
        appUrl: 'https://airemover.example.com',
        supportEmail: 'support@airemover.example.com',
        favicon: '/favicon.ico',
        previewImage: '/logo.png',
      },
      capabilities: {
        auth: true,
        payment: 'creem',
        ai: true,
        docs: false,
        blog: false,
      },
      configVersion: 1,
    }
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(result.stdout, /Site section: partial/);
  assert.match(
    result.stdout,
    /blocker  Site config could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  site_config:sites\/ai-remover\/site\.config\.json/
  );
  assert.match(result.stdout, /blocker  Missing site brand.logo/);
  assert.match(
    result.stdout,
    /source  site_config:sites\/ai-remover\/site\.config\.json:brand\.logo/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});
