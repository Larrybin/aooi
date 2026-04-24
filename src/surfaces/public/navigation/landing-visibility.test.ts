import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterLandingNavItems,
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from './landing-visibility';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

const runtimePublicConfig: PublicUiConfig = {
  aiEnabled: false,
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: false,
    promotekitEnabled: false,
  },
};

test('landing visibility 对 docs/blog 使用站点 capabilities，而不是 runtime public config', () => {
  assert.equal(isLandingDocsEnabled(runtimePublicConfig), true);
  assert.equal(isLandingBlogEnabled(runtimePublicConfig), true);
});

test('filterLandingNavItems 不因 runtime public config 缺少 docs/blog 开关而隐藏对应入口', () => {
  const items = filterLandingNavItems(
    [
      { title: 'Docs', url: '/docs' },
      { title: 'Blog', url: '/blog' },
      { title: 'Pricing', url: '/pricing' },
    ],
    runtimePublicConfig
  );

  assert.deepEqual(
    items.map((item) => item.url),
    ['/docs', '/blog', '/pricing']
  );
});
