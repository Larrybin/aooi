import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MarketingFooter } from './marketing-footer';
import { MarketingHeader } from './marketing-header';

test('marketing shell treats the logo as decorative when the brand title is visible', () => {
  const brand = {
    title: 'Text to Speech Generator',
    url: '/',
    logo: {
      src: '/logo.png',
      alt: 'Text to Speech Generator',
      width: 512,
      height: 512,
    },
  };

  const headerHtml = renderToStaticMarkup(
    <MarketingHeader
      header={{
        brand,
        nav: { items: [] },
        buttons: [],
        show_sign: false,
      }}
      locale="en"
    />
  );
  const footerHtml = renderToStaticMarkup(
    <MarketingFooter
      footer={{
        brand,
        nav: { items: [] },
      }}
      locale="en"
    />
  );

  assert.match(headerHtml, /<img[^>]*alt=""/);
  assert.match(footerHtml, /<img[^>]*alt=""/);
  assert.doesNotMatch(`${headerHtml}${footerHtml}`, /\/_next\/image/);
});
