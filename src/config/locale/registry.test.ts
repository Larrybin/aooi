import assert from 'node:assert/strict';
import test from 'node:test';

import { localeCodes, localeRegistry, parseLocaleRegistry } from './registry';

test('locale registry: canonical entries are valid and ordered from default locale', () => {
  assert.equal(localeRegistry[0]?.code, 'en');
  assert.ok(localeRegistry.some((entry) => entry.code === 'zh'));
  assert.ok(localeRegistry.some((entry) => entry.code === 'ja'));
  assert.ok(localeRegistry.some((entry) => entry.code === 'pt-BR'));
  assert.deepEqual(
    localeRegistry.map((entry) => entry.code),
    [...localeCodes]
  );
});

test('locale registry: rejects duplicate locale codes', () => {
  assert.throws(
    () =>
      parseLocaleRegistry([
        ...localeRegistry,
        { ...localeRegistry[0], hreflang: 'en-duplicate' },
      ]),
    /duplicate locale code \\"en\\"/
  );
});

test('locale registry: rejects duplicate hreflang values', () => {
  const duplicatedHreflangRegistry = localeRegistry.map((entry) => ({
    ...entry,
  }));
  duplicatedHreflangRegistry[1] = {
    ...duplicatedHreflangRegistry[1],
    hreflang: localeRegistry[0].hreflang,
  };

  assert.throws(
    () => parseLocaleRegistry(duplicatedHreflangRegistry),
    /duplicate hreflang \\"en\\"/
  );
});

test('locale registry: rejects invalid text direction', () => {
  const invalidDirectionRegistry = localeRegistry.map((entry) => ({
    ...entry,
  }));
  invalidDirectionRegistry[0] = {
    ...invalidDirectionRegistry[0],
    direction: 'sideways',
  };

  assert.throws(
    () => parseLocaleRegistry(invalidDirectionRegistry),
    /Invalid option/
  );
});

test('locale registry: rejects codes outside the literal locale contract', () => {
  assert.throws(
    () =>
      parseLocaleRegistry([
        ...localeRegistry,
        {
          code: 'xx',
          name: 'Example',
          englishName: 'Example',
          direction: 'ltr',
          hreflang: 'xx',
        },
      ]),
    /Invalid option/
  );
});

test('locale registry: exposes immutable parsed entries', () => {
  assert.equal(Object.isFrozen(localeRegistry), true);
  assert.equal(Object.isFrozen(localeRegistry[0]), true);
  assert.throws(() => {
    (localeRegistry as unknown[]).push(localeRegistry[0]);
  });
  const originalName = localeRegistry[0]?.name;
  assert.equal(
    Reflect.set(localeRegistry[0] as object, 'name', 'Changed'),
    false
  );
  assert.equal(localeRegistry[0]?.name, originalName);
});
