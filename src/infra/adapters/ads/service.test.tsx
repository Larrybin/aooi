import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import type { AdsRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { renderToStaticMarkup } from 'react-dom/server';

import { adsterraSnippetLog } from '@/extensions/ads/adsterra-snippet.server';

import { getAdsTxtBody, resolveAdsRuntime } from './runtime';

function createAdsSettings(
  overrides: Partial<Parameters<typeof resolveAdsRuntime>[0]>
): AdsRuntimeSettings {
  return {
    adsEnabled: false,
    adsProvider: '',
    adsenseClientId: '',
    adsenseSlotLandingInlinePrimary: '',
    adsenseSlotBlogPostInline: '',
    adsenseSlotBlogPostFooter: '',
    adsterraMode: '',
    adsterraGlobalSnippet: '',
    adsterraZoneLandingInlinePrimarySnippet: '',
    adsterraZoneBlogPostInlineSnippet: '',
    adsterraZoneBlogPostFooterSnippet: '',
    adsterraAdsTxtEntry: '',
    ...overrides,
  };
}

test('resolveAdsRuntime: ads disabled 时返回 empty runtime', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: false,
      adsProvider: 'adsense',
    })
  );

  assert.equal(runtime.enabled, false);
});

test('resolveAdsRuntime: AdSense 解析 client 和 zone slots', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: true,
      adsProvider: 'adsense',
      adsenseClientId: 'ca-pub-123456789',
      adsenseSlotLandingInlinePrimary: 'slot-1',
      adsenseSlotBlogPostInline: 'slot-2',
    })
  );

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.providerName, 'adsense');
  assert.equal(runtime.provider.supportsZone('landing_inline_primary'), true);
  assert.equal(runtime.provider.supportsZone('blog_post_footer'), false);
  assert.equal(
    getAdsTxtBody(runtime),
    'google.com, pub-123456789, DIRECT, f08c47fec0942fa0'
  );
});

test('resolveAdsRuntime: Adsterra zone mode 只启用有脚本的 zone', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: true,
      adsProvider: 'adsterra',
      adsterraMode: 'native_banner',
      adsterraZoneBlogPostInlineSnippet:
        '<script src="https://cdn.example.com/inline.js"></script>',
      adsterraAdsTxtEntry: 'adsterra.com, publisher-id, DIRECT',
    })
  );

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.providerName, 'adsterra');
  assert.equal(runtime.provider.supportsZone('blog_post_inline'), true);
  assert.equal(runtime.provider.supportsZone('landing_inline_primary'), false);
  assert.equal(getAdsTxtBody(runtime), 'adsterra.com, publisher-id, DIRECT');

  const markup = renderToStaticMarkup(
    runtime.provider.renderZone({
      zone: 'blog_post_inline',
      pageType: 'blog-detail',
    }) as ReactElement
  );
  assert.match(markup, /<script/);
  assert.match(markup, /https:\/\/cdn\.example\.com\/inline\.js/);
});

test('resolveAdsRuntime: Adsterra zone mode 通过 SSR 直出 snippet', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: true,
      adsProvider: 'adsterra',
      adsterraMode: 'display_banner',
      adsterraZoneBlogPostFooterSnippet:
        '<div class="ad-shell"></div><script src="https://cdn.example.com/footer.js"></script>',
    })
  );

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.provider.supportsZone('blog_post_footer'), true);
  assert.equal(runtime.provider.supportsZone('blog_post_inline'), false);

  const markup = renderToStaticMarkup(
    runtime.provider.renderZone({
      zone: 'blog_post_footer',
      pageType: 'blog-detail',
    }) as ReactElement
  );
  assert.match(markup, /class="ad-shell"/);
  assert.match(markup, /https:\/\/cdn\.example\.com\/footer\.js/);
});

test('resolveAdsRuntime: Popunder 通过 head SSR 直出 global snippet', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: true,
      adsProvider: 'adsterra',
      adsterraMode: 'popunder',
      adsterraGlobalSnippet:
        '<script src="https://cdn.example.com/popunder.js"></script>',
    })
  );

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.provider.supportsZone('blog_post_inline'), false);
  assert.equal(runtime.provider.getBodyScripts(), null);

  const markup = renderToStaticMarkup(
    runtime.provider.getHeadScripts() as ReactElement
  );
  assert.match(markup, /<script/);
  assert.match(markup, /https:\/\/cdn\.example\.com\/popunder\.js/);
});

test('resolveAdsRuntime: Social Bar 通过 body SSR 直出 global snippet', () => {
  const runtime = resolveAdsRuntime(
    createAdsSettings({
      adsEnabled: true,
      adsProvider: 'adsterra',
      adsterraMode: 'social_bar',
      adsterraGlobalSnippet:
        '<script src="https://cdn.example.com/social-bar.js"></script>',
    })
  );

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.provider.getHeadScripts(), null);
  const markup = renderToStaticMarkup(
    runtime.provider.getBodyScripts() as ReactElement
  );
  assert.match(markup, /<script/);
  assert.match(markup, /https:\/\/cdn\.example\.com\/social-bar\.js/);
});

test('resolveAdsRuntime: malformed Adsterra snippet 会记录日志并禁用 runtime', () => {
  const originalError = adsterraSnippetLog.error;
  const calls: unknown[] = [];

  adsterraSnippetLog.error = (message: string, meta?: unknown) => {
    calls.push({ message, meta });
  };

  try {
    const runtime = resolveAdsRuntime(
      createAdsSettings({
        adsEnabled: true,
        adsProvider: 'adsterra',
        adsterraMode: 'popunder',
        adsterraGlobalSnippet:
          '<script src="https://cdn.example.com/broken.js"',
      })
    );

    assert.equal(runtime.enabled, false);
    assert.equal(calls.length, 1);
    assert.match(
      String((calls[0] as { message: string }).message),
      /invalid Adsterra snippet/
    );
  } finally {
    adsterraSnippetLog.error = originalError;
  }
});
