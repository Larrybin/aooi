import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAuthUiRuntimeSettings, buildPublicUiConfig } from './settings-runtime.builders';

test('buildPublicUiConfig 在 fail-open 空洞输入下仍返回 closed object', () => {
  const config = buildPublicUiConfig({
    general_ai_enabled: 'true',
    private_secret: 'ignored',
  });

  assert.equal(config.aiEnabled, true);
  assert.deepEqual(config.socialLinks, []);
});

test('buildPublicUiConfig 返回 closed PublicUiConfig，不暴露 raw keys', () => {
  const config = buildPublicUiConfig({
    hiddenSiteIdentity: 'Hidden Site Identity',
    hiddenStoragePublicBaseUrl: 'https://cdn.example.com/assets/',
    general_ai_enabled: 'true',
    stripe_secret_key: 'hidden',
    general_social_links_enabled: 'true',
    general_social_links:
      '[{\"enabled\":true,\"icon\":\"RiGithubFill\",\"url\":\"https://github.com/example\"}]',
  });

  assert.equal(config.aiEnabled, true);
  assert.equal('general_ai_enabled' in (config as Record<string, unknown>), false);
  assert.equal('docsEnabled' in (config as Record<string, unknown>), false);
  assert.equal('blogEnabled' in (config as Record<string, unknown>), false);
  assert.equal(config.socialLinksEnabled, true);
  assert.equal(config.socialLinks.length, 1);
});

test('buildAuthUiRuntimeSettings 仅在 settings 开启且 server bindings 完整时暴露社交登录', () => {
  const config = buildAuthUiRuntimeSettings(
    {
      email_auth_enabled: 'false',
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'true',
      github_auth_enabled: 'true',
    },
    {
      googleClientId: 'google-id',
      googleClientSecret: '',
      githubClientId: 'github-id',
      githubClientSecret: 'github-secret',
    }
  );

  assert.equal(config.emailAuthEnabled, false);
  assert.equal(config.googleAuthEnabled, false);
  assert.equal(config.googleOneTapEnabled, false);
  assert.equal(config.googleClientId, '');
  assert.equal(config.githubAuthEnabled, true);
});
