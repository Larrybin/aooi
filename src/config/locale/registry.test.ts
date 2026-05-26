import assert from 'node:assert/strict';
import test from 'node:test';

import { localeRegistry, parseLocaleRegistry } from './registry';

test('locale registry: canonical entries are valid and ordered from default locale', () => {
  assert.equal(localeRegistry[0]?.code, 'en');
  assert.ok(localeRegistry.some((entry) => entry.code === 'zh'));
  assert.ok(localeRegistry.some((entry) => entry.code === 'ja'));
  assert.ok(localeRegistry.some((entry) => entry.code === 'pt-BR'));
});

test('locale registry: rejects duplicate locale codes', () => {
  assert.throws(() =>
    parseLocaleRegistry([
      localeRegistry[0],
      { ...localeRegistry[0], hreflang: 'en-duplicate' },
    ])
  );
});

test('locale registry: rejects duplicate hreflang values', () => {
  assert.throws(() =>
    parseLocaleRegistry([
      localeRegistry[0],
      { ...localeRegistry[1], hreflang: localeRegistry[0].hreflang },
    ])
  );
});

test('locale registry: rejects invalid text direction', () => {
  assert.throws(() =>
    parseLocaleRegistry([
      {
        code: 'xx',
        name: 'Example',
        englishName: 'Example',
        direction: 'sideways',
        hreflang: 'xx',
      },
    ])
  );
});
