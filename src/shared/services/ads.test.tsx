import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
    adsterra_zone_blog_post_inline_script_src:
      'https://cdn.example.com/inline.js',
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
  assert.match(markup, /https:\/\/cdn\.example\.com\/inline\.js/);
});

test('resolveAdsRuntime: Adsterra global mode 需要 global script', () => {
  const runtime = resolveAdsRuntime({
    ads_enabled: 'true',
    ads_provider: 'adsterra',
    adsterra_mode: 'social_bar',
    adsterra_global_script_src: 'https://cdn.example.com/social-bar.js',
  });

  assert.equal(runtime.enabled, true);
  if (!runtime.enabled) {
    return;
  }

  assert.equal(runtime.provider.supportsZone('blog_post_inline'), false);
  const markup = renderToStaticMarkup(
    runtime.provider.getBodyScripts() as ReactElement
  );
  assert.match(markup, /https:\/\/cdn\.example\.com\/social-bar\.js/);
});
