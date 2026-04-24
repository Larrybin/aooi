import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderRegistry, trimmedProviderNameKey } from './provider-registry';

type TestProvider = {
  readonly name: string;
  value: string;
};

test('ProviderRegistry resolves default provider and memoizes fallback', () => {
  const registry = new ProviderRegistry<TestProvider>({
    toNameKey: trimmedProviderNameKey,
    memoizeDefault: true,
  });

  const provider = { name: ' alpha ', value: 'a' };
  registry.add(provider);

  assert.equal(
    registry.getDefaultRequired(() => new Error('missing')),
    provider
  );
});

test('ProviderRegistry resolves named provider through normalized key', () => {
  const registry = new ProviderRegistry<TestProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  const provider = { name: 'replicate', value: 'r' };
  registry.add(provider);

  assert.equal(
    registry.getRequired(' replicate ', (name) => new Error(`missing ${name}`)),
    provider
  );
});

test('ProviderRegistry throws caller-provided error for missing default provider', () => {
  const registry = new ProviderRegistry<TestProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  assert.throws(
    () =>
      registry.getDefaultRequired(() => new Error('No provider configured')),
    /No provider configured/
  );
});

test('ProviderRegistry addUnique rejects empty and duplicate names', () => {
  const registry = new ProviderRegistry<TestProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  assert.throws(
    () =>
      registry.addUnique(
        { name: ' ', value: 'empty' },
        {
          invalidNameError: () => new Error('name required'),
          duplicateNameError: (name) => new Error(`duplicate ${name}`),
        }
      ),
    /name required/
  );

  registry.addUnique(
    { name: 'kie', value: 'first' },
    {
      invalidNameError: () => new Error('name required'),
      duplicateNameError: (name) => new Error(`duplicate ${name}`),
    }
  );

  assert.throws(
    () =>
      registry.addUnique(
        { name: ' kie ', value: 'second' },
        {
          invalidNameError: () => new Error('name required'),
          duplicateNameError: (name) => new Error(`duplicate ${name}`),
        }
      ),
    /duplicate kie/
  );
});
