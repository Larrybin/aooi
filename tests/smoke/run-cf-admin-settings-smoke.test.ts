import assert from 'node:assert/strict';
import test from 'node:test';

import { hasAuthErrorQuery, isTerminalAuthErrorUrl } from './auth-spike.browser';
import {
  buildMockProviderCallbackUrl,
  resolveSmokeLocales,
  runPhaseSequence,
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

test('buildMockProviderCallbackUrl 在 denied 模式保留 callback 并附带显式错误参数', () => {
  const callbackUrl = new URL(
    buildMockProviderCallbackUrl({
      authRequestUrl: new URL(
        'https://accounts.google.com/o/oauth2/auth?state=test-state&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fauth%2Fcallback%2Fgoogle'
      ),
      mode: 'denied',
      provider: 'google',
    })
  );

  assert.equal(callbackUrl.origin, 'http://localhost:8787');
  assert.equal(callbackUrl.pathname, '/api/auth/callback/google');
  assert.equal(callbackUrl.searchParams.get('state'), 'test-state');
  assert.equal(callbackUrl.searchParams.get('error'), 'access_denied');
  assert.equal(
    callbackUrl.searchParams.get('error_description'),
    'cf_admin_settings_phase2_denied'
  );
});

test('denied redirect chain 只有最终 sign-in 错误页才满足 terminal 判定', () => {
  const callbackUrl = buildMockProviderCallbackUrl({
    authRequestUrl: new URL(
      'https://accounts.google.com/o/oauth2/auth?state=test-state&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fauth%2Fcallback%2Fgoogle'
    ),
    mode: 'denied',
    provider: 'google',
  });

  assert.equal(hasAuthErrorQuery(callbackUrl), true);
  assert.equal(isTerminalAuthErrorUrl(callbackUrl), false);
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile&error=access_denied'
    ),
    true
  );
});

test('isTerminalAuthErrorUrl 只在 sign-in 最终错误页返回 true', () => {
  assert.equal(
    isTerminalAuthErrorUrl('http://localhost:8787/sign-in?error=access_denied'),
    true
  );
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    false
  );
  assert.equal(isTerminalAuthErrorUrl('http://localhost:8787/settings/profile'), false);
  assert.equal(isTerminalAuthErrorUrl('not-a-url'), false);
});
