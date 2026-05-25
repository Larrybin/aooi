import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterLandingButtons,
  filterLandingNavItems,
  isLandingBlogEnabled,
  isLandingDocsEnabled,
} from './landing-visibility';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { site } from '@/site';

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
  const originalDocs = site.capabilities.docs;
  const originalBlog = site.capabilities.blog;
  site.capabilities.docs = true;
  site.capabilities.blog = true;

  try {
    assert.equal(isLandingDocsEnabled(runtimePublicConfig), true);
    assert.equal(isLandingBlogEnabled(runtimePublicConfig), true);
  } finally {
    site.capabilities.docs = originalDocs;
    site.capabilities.blog = originalBlog;
  }
});

test('filterLandingNavItems 不因 runtime public config 缺少 docs/blog 开关而隐藏对应入口', () => {
  const originalDocs = site.capabilities.docs;
  const originalBlog = site.capabilities.blog;
  site.capabilities.docs = true;
  site.capabilities.blog = true;

  try {
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
  } finally {
    site.capabilities.docs = originalDocs;
    site.capabilities.blog = originalBlog;
  }
});

test('filterLandingNavItems hides AI routes when runtime public config disables AI', () => {
  const items = filterLandingNavItems(
    [
      { title: 'Image AI', url: '/ai-image-generator' },
      { title: 'Chat', url: '/chat' },
      { title: 'Activity', url: '/activity' },
      { title: 'Pricing', url: '/pricing' },
    ],
    runtimePublicConfig
  );

  assert.deepEqual(
    items.map((item) => item.url),
    ['/pricing']
  );
});

test('filterLandingButtons hides AI routes when runtime public config disables AI', () => {
  const buttons = filterLandingButtons(
    [
      { title: 'Generate', url: '/ai-image-generator' },
      { title: 'Chat', url: '/chat' },
      { title: 'Pricing', url: '/pricing' },
    ],
    runtimePublicConfig
  );

  assert.deepEqual(
    buttons.map((button) => button.url),
    ['/pricing']
  );
});
