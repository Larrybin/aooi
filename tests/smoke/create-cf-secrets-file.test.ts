import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildCloudflareSecretsEnv,
  resolveCloudflareAuthSecretValue,
} from '../../scripts/create-cf-secrets-file.mjs';
import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import {
  readSiteDeploySettings,
  resolveSiteDeploySettingsPath,
} from '../../scripts/lib/site-deploy-settings.mjs';

test('resolveCloudflareAuthSecretValue 优先 BETTER_AUTH_SECRET，其次 AUTH_SECRET', () => {
  assert.equal(
    resolveCloudflareAuthSecretValue({
      BETTER_AUTH_SECRET: 'better-secret',
      AUTH_SECRET: 'auth-secret',
    }),
    'better-secret'
  );
  assert.equal(
    resolveCloudflareAuthSecretValue({
      AUTH_SECRET: 'auth-secret',
    }),
    'auth-secret'
  );
});

test('buildCloudflareSecretsEnv 只输出白名单 secret，并为缺失项补同一 auth secret', () => {
  const content = buildCloudflareSecretsEnv(
    {
      BETTER_AUTH_SECRET: 'better-secret',
      OTHER_SECRET: 'ignored',
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['auth'],
    }
  );

  assert.equal(
    content,
    ['BETTER_AUTH_SECRET=better-secret', 'AUTH_SECRET=better-secret', ''].join(
      '\n'
    )
  );
});

test('buildCloudflareSecretsEnv 仅提供 AUTH_SECRET 时仍双写输出 auth shared secret', () => {
  const content = buildCloudflareSecretsEnv(
    {
      AUTH_SECRET: 'auth-secret',
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['auth'],
    }
  );

  assert.equal(
    content,
    ['BETTER_AUTH_SECRET=auth-secret', 'AUTH_SECRET=auth-secret', ''].join('\n')
  );
});

test('buildCloudflareSecretsEnv 缺少 workerKeys 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv({
        BETTER_AUTH_SECRET: 'better-secret',
        SITE: 'mamamiya',
      }),
    /worker scope is required/i
  );
});

test('buildCloudflareSecretsEnv 在 state worker 缺少 auth secret 时不失败', () => {
  const content = buildCloudflareSecretsEnv(
    {
      SITE: 'mamamiya',
    },
    {
      workerKeys: ['state'],
    }
  );

  assert.equal(content, '\n');
});

test('buildCloudflareSecretsEnv 在 server worker 缺少 auth secret 时失败', () => {
  assert.throws(
    () =>
      buildCloudflareSecretsEnv(
        {
          SITE: 'mamamiya',
        },
        {
          workerKeys: ['auth'],
        }
      ),
    /BETTER_AUTH_SECRET or AUTH_SECRET/i
  );
});

test('buildCloudflareSecretsEnv 仅输出当前启用能力所需 secrets', () => {
  const content = buildCloudflareSecretsEnv(
    {
      BETTER_AUTH_SECRET: 'better-secret',
      SITE: 'mamamiya',
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      OPENROUTER_API_KEY: 'or-key',
      PAYPAL_CLIENT_ID: 'paypal-id',
    },
    {
      workerKeys: ['auth', 'payment', 'member', 'chat'],
    }
  );

  assert.doesNotMatch(content, /GOOGLE_CLIENT_ID=google-id/);
  assert.doesNotMatch(content, /GOOGLE_CLIENT_SECRET=google-secret/);
  assert.doesNotMatch(content, /GITHUB_CLIENT_ID=github-id/);
  assert.doesNotMatch(content, /GITHUB_CLIENT_SECRET=github-secret/);
  assert.doesNotMatch(content, /OPENROUTER_API_KEY=or-key/);
  assert.doesNotMatch(content, /PAYPAL_CLIENT_ID=paypal-id/);
  assert.doesNotMatch(content, /STRIPE_SECRET_KEY=/);
  assert.doesNotMatch(content, /REPLICATE_API_TOKEN=/);
});

test('buildCloudflareSecretsEnv 按 deploy.settings.json 与 workerKeys 限定 secrets 输出范围', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-secrets-site-'));
  const sourcePath = resolveSiteDeploySettingsPath({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const targetDir = path.join(tempDir, 'sites/mamamiya');
  const targetPath = path.join(targetDir, 'deploy.settings.json');

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(
      path.join(targetDir, 'site.config.json'),
      JSON.stringify(
        {
          ...readCurrentSiteConfig({ siteKey: 'mamamiya' }),
          capabilities: {
            ...readCurrentSiteConfig({ siteKey: 'mamamiya' }).capabilities,
            auth: true,
            ai: false,
            payment: 'none',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await writeFile(
      targetPath,
      JSON.stringify(
        {
          ...readSiteDeploySettings({ siteKey: 'mamamiya' }),
          bindingRequirements: {
            ...readSiteDeploySettings({ siteKey: 'mamamiya' })
              .bindingRequirements,
            secrets: {
              ...readSiteDeploySettings({ siteKey: 'mamamiya' })
                .bindingRequirements.secrets,
              googleOauth: true,
            },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
  } catch {
    await rm(tempDir, { recursive: true, force: true });
    throw new Error(
      `failed to prepare deploy settings fixture from ${sourcePath}`
    );
  }

  try {
    const originalSite = process.env.SITE;
    delete process.env.SITE;
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const content = buildCloudflareSecretsEnv(
        {
          BETTER_AUTH_SECRET: 'better-secret',
          SITE: 'mamamiya',
          GOOGLE_CLIENT_ID: 'google-id',
          GOOGLE_CLIENT_SECRET: 'google-secret',
          STRIPE_PUBLISHABLE_KEY: 'pk',
          STRIPE_SECRET_KEY: 'sk',
          STRIPE_SIGNING_SECRET: 'ss',
        },
        {
          workerKeys: ['auth'],
        }
      );

      assert.match(content, /GOOGLE_CLIENT_ID=google-id/);
      assert.match(content, /GOOGLE_CLIENT_SECRET=google-secret/);
      assert.doesNotMatch(content, /STRIPE_PUBLISHABLE_KEY=pk/);
      assert.doesNotMatch(content, /STRIPE_SECRET_KEY=sk/);
    } finally {
      process.chdir(originalCwd);
      if (originalSite === undefined) {
        delete process.env.SITE;
      } else {
        process.env.SITE = originalSite;
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
