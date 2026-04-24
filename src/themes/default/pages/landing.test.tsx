import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Landing } from '@/shared/types/blocks/landing';

import { LandingPageView } from './landing-view';

function renderLandingPage(page: Landing) {
  return renderToStaticMarkup(
    <LandingPageView
      page={page}
      landingInlinePrimaryAd={<div data-ad-zone="landing_inline_primary" />}
    />
  );
}

test('LandingPageView: 无 logos 时仍在首个区块后插入广告位', () => {
  const markup = renderLandingPage({
    hero: {
      id: 'hero-section',
      title: 'Hero',
      description: 'Desc',
    },
    usage: {
      id: 'usage-section',
      title: 'Usage',
      description: 'How it works',
      items: [],
    },
  });

  const heroIndex = markup.indexOf('id="hero-section"');
  const adIndex = markup.indexOf('data-ad-zone="landing_inline_primary"');
  const usageIndex = markup.indexOf('id="usage-section"');

  assert.notEqual(heroIndex, -1);
  assert.notEqual(adIndex, -1);
  assert.notEqual(usageIndex, -1);
  assert.equal(heroIndex < adIndex, true);
  assert.equal(adIndex < usageIndex, true);
});

test('LandingPageView: 有 hero 和 logos 时广告位只出现一次且位于 hero 之后', () => {
  const markup = renderLandingPage({
    hero: {
      id: 'hero-section',
      title: 'Hero',
      description: 'Desc',
    },
    logos: {
      id: 'logos-section',
      title: 'Trusted by',
      items: [
        {
          title: 'Logo',
          image: {
            src: '/imgs/avatars/1.png',
            alt: 'Logo',
          },
        },
      ],
    },
  });

  const heroIndex = markup.indexOf('id="hero-section"');
  const adIndex = markup.indexOf('data-ad-zone="landing_inline_primary"');
  const logosIndex = markup.indexOf('id="logos-section"');
  const adCount = markup.match(
    /data-ad-zone="landing_inline_primary"/g
  )?.length;

  assert.notEqual(heroIndex, -1);
  assert.notEqual(adIndex, -1);
  assert.notEqual(logosIndex, -1);
  assert.equal(adCount, 1);
  assert.equal(heroIndex < adIndex, true);
  assert.equal(adIndex < logosIndex, true);
});
