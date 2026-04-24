import assert from 'node:assert/strict';
import test from 'node:test';

import { runPhaseSequence } from '../../scripts/lib/harness/scenario.mjs';
import {
  assertPublicSettingsProjection,
  buildExpectedPublicAssetUrls,
  buildSignedInSessionCookieHeader,
  resolveSmokeLocales,
  waitForAdminSettingsSmokeReady,
} from '../../scripts/run-cf-admin-settings-smoke.mjs';

test('runPhaseSequence 按声明顺序执行 phase 并在最后执行 cleanup', async () => {
  const steps: string[] = [];

  await runPhaseSequence({
    phases: [
      {
        label: 'preview-ready',
        action: async () => {
          steps.push('preview-ready');
        },
      },
      {
        label: 'preview-sanity',
        action: async () => {
          steps.push('preview-sanity');
        },
      },
      {
        label: 'rbac-bootstrap',
        action: async () => {
          steps.push('rbac-bootstrap');
        },
      },
    ],
    cleanup: async () => {
      steps.push('cleanup');
    },
  });

  assert.deepEqual(steps, [
    'preview-ready',
    'preview-sanity',
    'rbac-bootstrap',
    'cleanup',
  ]);
});

test('runPhaseSequence 在中途 phase 失败时仍执行 cleanup', async () => {
  const steps: string[] = [];

  await assert.rejects(
    runPhaseSequence({
      phases: [
        {
          label: 'baseline-capture',
          action: async () => {
            steps.push('baseline-capture');
          },
        },
        {
          label: 'general-write-success',
          action: async () => {
            steps.push('general-write-success');
            throw new Error('boom');
          },
        },
        {
          label: 'general-write-failure',
          action: async () => {
            steps.push('general-write-failure');
          },
        },
      ],
      cleanup: async () => {
        steps.push('cleanup');
      },
    }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('[general-write-success] boom')
  );

  assert.deepEqual(steps, [
    'baseline-capture',
    'general-write-success',
    'cleanup',
  ]);
});

test('resolveSmokeLocales 默认返回全部 locale，并支持显式过滤', () => {
  const allLocales = ['en', 'zh', 'ja'];

  assert.deepEqual(resolveSmokeLocales(allLocales, undefined), allLocales);
  assert.deepEqual(resolveSmokeLocales(allLocales, 'en,ja'), ['en', 'ja']);
  assert.throws(
    () => resolveSmokeLocales(allLocales, 'en,xx'),
    /Unknown CF_ADMIN_SETTINGS_SMOKE_LOCALES entries: xx/
  );
});

test('buildExpectedPublicAssetUrls 由 STORAGE_PUBLIC_BASE_URL 和 objectKey 派生公开 URL', () => {
  assert.deepEqual(
    buildExpectedPublicAssetUrls({
      storagePublicBaseUrl: 'https://cdn.example.com/assets',
      objectKeys: {
        appLogo: '/uploads/logo.png',
        appFavicon: 'uploads/favicon.ico',
        appOgImage: 'uploads/preview.png',
      },
    }),
    {
      appLogo: 'https://cdn.example.com/assets/uploads/logo.png',
      appFavicon: 'https://cdn.example.com/assets/uploads/favicon.ico',
      appOgImage: 'https://cdn.example.com/assets/uploads/preview.png',
    }
  );
});

test('buildSignedInSessionCookieHeader 为 API smoke 构造 better-auth session cookie', () => {
  assert.equal(
    buildSignedInSessionCookieHeader('session token+123'),
    'better-auth.session_token=session%20token%2B123'
  );
});

test('assertPublicSettingsProjection 仅校验 public config projection', () => {
  assert.doesNotThrow(() =>
    assertPublicSettingsProjection({
      publicConfigs: {
        general_ai_enabled: 'true',
      },
    })
  );
});

test('waitForAdminSettingsSmokeReady 只复用最小 config-api ready probe', async () => {
  const calls: string[] = [];

  await waitForAdminSettingsSmokeReady({
    baseUrl: 'http://127.0.0.1:8788',
    waitForPreviewReadyImpl: async ({ baseUrl }) => {
      calls.push(baseUrl);
    },
  });

  assert.deepEqual(calls, ['http://127.0.0.1:8788']);
});
