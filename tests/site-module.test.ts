import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { site } from '@/site';

test('@/site: exposes complete build-time site identity', () => {
  assert.equal(site.key, 'dev-local');
  assert.equal(site.domain, 'localhost');
  assert.equal(site.brand.appUrl, 'http://localhost:3000');
  assert.equal(typeof site.brand.appName, 'string');
  assert.equal(typeof site.brand.logo, 'string');
  assert.equal(typeof site.brand.favicon, 'string');
  assert.equal(typeof site.brand.previewImage, 'string');
  assert.equal(site.configVersion, 1);
});

test('@/site: SITE=mamamiya resolves production identity when explicitly selected', async () => {
  const source = await readFile('sites/mamamiya/site.config.json', 'utf8');
  const mamamiya = JSON.parse(source);

  assert.equal(mamamiya.key, 'mamamiya');
  assert.equal(mamamiya.domain, 'mamamiya.pdfreprinting.net');
  assert.equal(mamamiya.brand.appUrl, 'https://mamamiya.pdfreprinting.net');
});

test('@/site: generated module is a pure literal module', async () => {
  const source = await readFile('.generated/site.ts', 'utf8');

  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('export {'), false);
  assert.equal(source.includes('export const site = {'), true);
});
