import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAppEnvironment } from './types';

test('resolveAppEnvironment keeps invalid production config production-safe', () => {
  assert.equal(
    resolveAppEnvironment({
      configured: 'prodution',
      nodeEnv: 'production',
    }),
    'production'
  );
});

test('resolveAppEnvironment falls back to local outside production', () => {
  assert.equal(
    resolveAppEnvironment({
      configured: 'invalid',
      nodeEnv: 'development',
    }),
    'local'
  );
});

test('resolveAppEnvironment accepts valid configured environments', () => {
  assert.equal(
    resolveAppEnvironment({
      configured: 'preview',
      nodeEnv: 'production',
    }),
    'preview'
  );
});
