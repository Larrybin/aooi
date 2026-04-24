import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const generatedSiteModulePath = path.resolve(
  process.cwd(),
  '.generated/site.ts'
);

async function generateSiteModule(siteKey: string) {
  await execFileAsync(process.execPath, ['scripts/generate-site-module.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SITE: siteKey,
    },
  });
}

async function importGeneratedSite(siteKey: string) {
  await generateSiteModule(siteKey);
  const source = await readFile(generatedSiteModulePath, 'utf8');
  const siteLiteral = source.match(
    /export const site = ([\s\S]+?) as const;\s*$/
  );
  assert.ok(
    siteLiteral?.[1],
    'generated site module must export a site literal'
  );

  return Function(`return (${siteLiteral[1]});`)() as {
    key: string;
    domain: string;
    brand: {
      appName: string;
      appUrl: string;
      logo: string;
      favicon: string;
      previewImage: string;
    };
    configVersion: number;
  };
}

test('@/site: exposes complete build-time site identity', async () => {
  const site = await importGeneratedSite('dev-local');

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
  const site = await importGeneratedSite('mamamiya');

  assert.equal(site.key, 'mamamiya');
  assert.equal(site.domain, 'mamamiya.pdfreprinting.net');
  assert.equal(site.brand.appUrl, 'https://mamamiya.pdfreprinting.net');
});

test('@/site: generated module is a pure literal module', async () => {
  await generateSiteModule('dev-local');
  const source = await readFile(generatedSiteModulePath, 'utf8');

  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('export {'), false);
  assert.equal(source.includes('export const site = {'), true);
});
