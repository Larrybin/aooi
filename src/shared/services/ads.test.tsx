import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { adsterraSnippetLog } from '@/extensions/ads/adsterra-snippet.server';

import { getAdsTxtBody, resolveAdsRuntime } from './ads-runtime';

test('resolveAdsRuntime: ads disabled 时返回 empty runtime', () => {
  const runtime = resolveAdsRuntime({
    ads_enabled: 'false',
    ads_provider: 'adsense',
  });

  assert.equal(runtime.enabled, false);
});

test('resolveAdsRuntime: AdSense 解析 client 和 zone slots', () => {
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsense',
    adsense_client_id: 'ca-pub-123456789',
    adsense_slot_landing_inline_primary: 'slot-1',
    adsense_slot_blog_post_inline: 'slot-2',
  });

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
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsterra',
    adsterra_mode: 'native_banner',
    adsterra_zone_blog_post_inline_snippet:
      '<script src="https://cdn.example.com/inline.js"></script>',
    adsterra_ads_txt_entry: 'adsterra.com, publisher-id, DIRECT',
  });

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
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsterra',
    adsterra_mode: 'display_banner',
    adsterra_zone_blog_post_footer_snippet:
      '<div class="ad-shell"></div><script src="https://cdn.example.com/footer.js"></script>',
  });

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
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsterra',
    adsterra_mode: 'popunder',
    adsterra_global_snippet:
      '<script src="https://cdn.example.com/popunder.js"></script>',
  });

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
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsterra',
    adsterra_mode: 'social_bar',
    adsterra_global_snippet:
      '<script src="https://cdn.example.com/social-bar.js"></script>',
  });

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
    const runtime = resolveAdsRuntime({
      ads_enabled: 'true',
      ads_provider: 'adsterra',
      adsterra_mode: 'popunder',
      adsterra_global_snippet: '<script src="https://cdn.example.com/broken.js"',
    });

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
