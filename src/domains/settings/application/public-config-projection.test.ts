import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthUiRuntimeSettings,
  buildPublicUiConfig,
} from './settings-runtime.builders';

test('buildPublicUiConfig 以 site AI capability 作为数据库开关上限', () => {
  const config = buildPublicUiConfig({
    general_ai_enabled: 'true',
    private_secret: 'ignored',
  });

  assert.equal(config.aiEnabled, false);
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

  assert.equal(config.aiEnabled, false);
  assert.equal(
    'general_ai_enabled' in (config as Record<string, unknown>),
    false
  );
  assert.equal('docsEnabled' in (config as Record<string, unknown>), false);
  assert.equal('blogEnabled' in (config as Record<string, unknown>), false);
  assert.equal(config.socialLinksEnabled, true);
  assert.equal(config.socialLinks.length, 1);
});

test('buildAuthUiRuntimeSettings 根据 settings 暴露社交登录，并在缺少 Google client id 时禁用 One Tap', () => {
  const config = buildAuthUiRuntimeSettings(
    {
      email_auth_enabled: 'false',
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'true',
      github_auth_enabled: 'true',
    },
    {
      googleClientId: '',
      googleClientSecret: '',
      githubClientId: '',
      githubClientSecret: '',
    }
  );

  assert.equal(config.emailAuthEnabled, false);
  assert.equal(config.googleAuthEnabled, true);
  assert.equal(config.googleOneTapEnabled, false);
  assert.equal(config.googleClientId, '');
  assert.equal(config.githubAuthEnabled, true);
});

test('buildAuthUiRuntimeSettings 在 Google One Tap 可用时暴露 google client id', () => {
  const config = buildAuthUiRuntimeSettings(
    {
      email_auth_enabled: 'false',
      google_auth_enabled: 'true',
      google_one_tap_enabled: 'true',
      github_auth_enabled: 'false',
    },
    {
      googleClientId: 'google-id',
      googleClientSecret: '',
      githubClientId: '',
      githubClientSecret: '',
    }
  );

  assert.equal(config.googleAuthEnabled, true);
  assert.equal(config.googleOneTapEnabled, true);
  assert.equal(config.googleClientId, 'google-id');
  assert.equal(config.githubAuthEnabled, false);
});
