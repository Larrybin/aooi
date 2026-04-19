import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyOAuthSpikeReport,
  createOAuthProviderResult,
  deriveOAuthSpikeConclusion,
  summarizeOAuthFailureKinds,
} from '../../src/testing/oauth-spike.shared';

test('deriveOAuthSpikeConclusion 对全绿报告返回 PASS', () => {
  const report = createEmptyOAuthSpikeReport({
    callbackPath: '/settings/profile',
    commitSha: 'test',
    runId: 'latest',
  });
  report.providers.push(createOAuthProviderResult('google'));

  const conclusion = deriveOAuthSpikeConclusion(report);

  assert.equal(conclusion.rawConclusion, 'PASS');
  assert.equal(conclusion.harnessStatus, 'PASS');
});

test('deriveOAuthSpikeConclusion 对 preflight 失败返回 BLOCKED', () => {
  const report = createEmptyOAuthSpikeReport({
    callbackPath: '/settings/profile',
    commitSha: 'test',
    runId: 'latest',
  });
  report.preflight.push({
    name: 'google-button',
    status: 'failed',
    detail: 'button not visible',
    surface: 'cloudflare',
  });

  const conclusion = deriveOAuthSpikeConclusion(report);

  assert.equal(conclusion.rawConclusion, 'BLOCKED');
  assert.equal(conclusion.harnessStatus, 'FAIL');
});

test('deriveOAuthSpikeConclusion 对核心流程失败返回 需要替代路线', () => {
  const report = createEmptyOAuthSpikeReport({
    callbackPath: '/settings/profile',
    commitSha: 'test',
    runId: 'latest',
  });
  const provider = createOAuthProviderResult('google');
  provider.cases.push({
    name: 'callback_success',
    status: 'failed',
    detail: 'redirect failed',
    screenshotPath: null,
  });
  summarizeOAuthFailureKinds(provider);
  report.providers.push(provider);

  const conclusion = deriveOAuthSpikeConclusion(report);

  assert.equal(conclusion.rawConclusion, '需要替代路线');
  assert.equal(conclusion.harnessStatus, 'FAIL');
});

test('deriveOAuthSpikeConclusion 对失败路径语义问题返回 需要 adapter', () => {
  const report = createEmptyOAuthSpikeReport({
    callbackPath: '/settings/profile',
    commitSha: 'test',
    runId: 'latest',
  });
  const provider = createOAuthProviderResult('google');
  provider.cases.push({
    name: 'state_tamper',
    status: 'failed',
    detail: 'error path mismatch',
    screenshotPath: null,
  });
  summarizeOAuthFailureKinds(provider);
  report.providers.push(provider);

  const conclusion = deriveOAuthSpikeConclusion(report);

  assert.equal(conclusion.rawConclusion, '需要 adapter');
  assert.equal(conclusion.harnessStatus, 'FAIL');
});
