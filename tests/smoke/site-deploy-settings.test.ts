import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readSiteDeploySettings,
  validateSiteDeploySettings,
} from '../../scripts/lib/site-deploy-settings.mjs';
import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';

test('site deploy settings 读取当前闭合 manifest', () => {
  const settings = readSiteDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.equal(settings.configVersion, 1);
  assert.equal(settings.bindingRequirements.secrets.authSharedSecret, true);
  assert.equal(settings.workers.router, 'roller-rabbit');
  assert.equal(settings.state.schemaVersion, 1);
});

test('site deploy settings 拒绝未知嵌套字段', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              stripe: false,
              creem: false,
              paypal: false,
              openrouter: false,
              extraSecret: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            auth: 'worker-auth',
            payment: 'worker-payment',
            member: 'worker-member',
            chat: 'worker-chat',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /bindingRequirements\.secrets must contain exactly/i
  );
});

test('site deploy settings 在 site.config 与 deploy manifest 语义冲突时失败', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              stripe: true,
              creem: false,
              paypal: false,
              openrouter: false,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            auth: 'worker-auth',
            payment: 'worker-payment',
            member: 'worker-member',
            chat: 'worker-chat',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /payment=none/i
  );
});

test('site deploy settings 保留 ai 重叠语义一致性校验', () => {
  const siteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.throws(
    () =>
      validateSiteDeploySettings(
        {
          configVersion: 1,
          bindingRequirements: {
            secrets: {
              authSharedSecret: true,
              googleOauth: false,
              githubOauth: false,
              stripe: false,
              creem: false,
              paypal: false,
              openrouter: true,
            },
            vars: {
              storagePublicBaseUrl: true,
            },
          },
          workers: {
            router: 'worker-router',
            state: 'worker-state',
            'public-web': 'worker-public-web',
            auth: 'worker-auth',
            payment: 'worker-payment',
            member: 'worker-member',
            chat: 'worker-chat',
            admin: 'worker-admin',
          },
          resources: {
            incrementalCacheBucket: 'bucket-a',
            appStorageBucket: 'bucket-b',
            hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
          },
          state: {
            schemaVersion: 1,
          },
        },
        { siteConfig }
      ),
    /ai=false forbids openrouter/i
  );
});

test('site deploy settings 不再把 auth/docs/blog 拓扑政策塞进 cross-contract validator', () => {
  const currentSiteConfig = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const siteConfig = {
    ...currentSiteConfig,
    capabilities: {
      ...currentSiteConfig.capabilities,
      auth: false,
      docs: false,
      blog: false,
    },
  };

  assert.doesNotThrow(() =>
    validateSiteDeploySettings(
      {
        configVersion: 1,
        bindingRequirements: {
          secrets: {
            authSharedSecret: true,
            googleOauth: false,
            githubOauth: false,
            stripe: false,
            creem: false,
            paypal: false,
            openrouter: false,
          },
          vars: {
            storagePublicBaseUrl: true,
          },
        },
        workers: {
          router: 'worker-router',
          state: 'worker-state',
          'public-web': 'worker-public-web',
          auth: 'worker-auth',
          payment: 'worker-payment',
          member: 'worker-member',
          chat: 'worker-chat',
          admin: 'worker-admin',
        },
        resources: {
          incrementalCacheBucket: 'bucket-a',
          appStorageBucket: 'bucket-b',
          hyperdriveId: 'd208cd72765b46a7b0849fc687e2fb61',
        },
        state: {
          schemaVersion: 1,
        },
      },
      { siteConfig }
    )
  );
});
