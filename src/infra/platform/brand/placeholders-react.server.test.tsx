import assert from 'node:assert/strict';
import test from 'node:test';
import React, { createElement } from 'react';

import { replaceBrandPlaceholdersInReactNode } from './placeholders-react.server';

const brand = {
  appName: 'Mamamiya',
  appUrl: 'https://mamamiya.ai',
  appLogo: '/logo.png',
  appFavicon: '/favicon.ico',
  appOgImage: '/og.png',
  domain: 'mamamiya.ai',
  supportEmail: 'support@mamamiya.ai',
} as const;

test('replaceBrandPlaceholdersInReactNode preserves React child keys for mixed MDX-like content', () => {
  const node = createElement(
    'div',
    null,
    createElement(
      'p',
      null,
      'Visit ',
      createElement('code', null, 'YourAppName'),
      ' at ',
      createElement('a', { href: 'https://your-domain.com' }, 'Roller Rabbit'),
      '.'
    ),
    createElement(
      'ul',
      null,
      createElement(
        'li',
        null,
        'Email ',
        createElement('code', null, 'support@your-domain.com')
      )
    )
  );

  const replaced = replaceBrandPlaceholdersInReactNode(node, brand);
  assert.ok(React.isValidElement(replaced));

  const rootChildren = replaced.props.children as unknown[];
  assert.ok(Array.isArray(rootChildren));
  const paragraph = rootChildren[0];
  const list = rootChildren[1];

  assert.ok(React.isValidElement(paragraph));
  assert.ok(React.isValidElement(list));

  const paragraphChildren = paragraph.props.children as unknown[];
  assert.ok(Array.isArray(paragraphChildren));
  const codeChild = paragraphChildren[1];
  const linkChild = paragraphChildren[3];

  assert.ok(React.isValidElement(codeChild));
  assert.ok(React.isValidElement(linkChild));
  assert.equal(codeChild.key, '.1');
  assert.equal(linkChild.key, '.3');
  assert.equal(codeChild.props.children, 'Mamamiya');
  assert.equal(linkChild.props.children, 'Mamamiya');
  assert.equal(linkChild.props.href, 'https://mamamiya.ai');

  const listItem = list.props.children;
  assert.ok(React.isValidElement(listItem));

  const listItemChildren = listItem.props.children as unknown[];
  assert.ok(Array.isArray(listItemChildren));
  const supportCode = listItemChildren[1];
  assert.ok(React.isValidElement(supportCode));
  assert.equal(supportCode.key, '.1');
  assert.equal(supportCode.props.children, 'support@mamamiya.ai');
});
