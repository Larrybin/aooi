import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { site } from '@/site';

import {
  buildAuthUiSettingsFromSite,
  buildBillingUiSettingsFromSite,
  readBuildAuthUiSettings,
  readBuildBillingUiSettings,
  readBuildPricingDisplayConfig,
  readBuildPublicUiConfig,
} from './settings-build.query';

const rootDir = process.cwd();

function readRepoFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(rootDir, ...segments), 'utf8');
}

function collectImportSpecifiers(content: string): string[] {
  const specifiers = new Set<string>();
  const fromImports = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
  const sideEffectImports = content.matchAll(/import\s+['"]([^'"]+)['"]/g);

  for (const match of fromImports) {
    specifiers.add(match[1] ?? '');
  }

  for (const match of sideEffectImports) {
    specifiers.add(match[1] ?? '');
  }

  return [...specifiers].filter(Boolean).sort();
}

test('settings-build query keeps a DB-free import boundary', () => {
  const content = readRepoFile(
    'src',
    'domains',
    'settings',
    'application',
    'settings-build.query.ts'
  );
  const imports = collectImportSpecifiers(content);

  for (const specifier of imports) {
    assert.equal(
      specifier.includes('settings-store'),
      false,
      `${specifier} must not be imported by settings-build.query.ts`
    );
    assert.equal(
      specifier.includes('settings-runtime.query'),
      false,
      `${specifier} must not be imported by settings-build.query.ts`
    );
    assert.equal(
      specifier.includes('infra/adapters/db') ||
        specifier.includes('/config/db') ||
        specifier.endsWith('/db'),
      false,
      `${specifier} must not be imported by settings-build.query.ts`
    );
    assert.equal(
      specifier.includes('infra/runtime/env.server') ||
        specifier.includes('config/env-contract'),
      false,
      `${specifier} must not be imported by settings-build.query.ts`
    );
  }

  assert.equal(content.includes('DATABASE_URL'), false);
  assert.equal(content.includes('readSettingsCached'), false);
  assert.equal(content.includes('readSettingsFresh'), false);
});

test('pricing layout no longer imports runtime settings readers', () => {
  const content = readRepoFile(
    'src',
    'app',
    '[locale]',
    '(landing)',
    'pricing',
    'layout.tsx'
  );

  assert.equal(content.includes('settings-runtime.query'), false);
  assert.equal(content.includes('readPublicUiConfigCached'), false);
  assert.equal(content.includes('readAuthUiRuntimeSettingsCached'), false);
  assert.equal(content.includes('readBillingRuntimeSettingsCached'), false);
  assert.equal(content.includes('readSettingsCached'), false);
});

test('build auth settings are conservative and do not synthesize Google client ids', () => {
  const settings = buildAuthUiSettingsFromSite({
    capabilities: {
      auth: true,
      ai: true,
      payment: 'creem',
      docs: false,
      blog: false,
    },
  });

  assert.equal(settings.emailAuthEnabled, true);
  assert.equal(settings.googleAuthEnabled, false);
  assert.equal(settings.googleOneTapEnabled, false);
  assert.equal(settings.googleClientId, '');
  assert.equal(settings.githubAuthEnabled, false);
  assert.equal(readBuildAuthUiSettings().googleClientId, '');
});

test('build billing settings do not evaluate secrets or provider product mapping readiness', () => {
  const settings = buildBillingUiSettingsFromSite({
    capabilities: {
      auth: true,
      ai: true,
      payment: 'creem',
      docs: false,
      blog: false,
    },
  });

  assert.deepEqual(settings, {
    locale: '',
    defaultLocale: 'en',
    provider: 'creem',
    paymentCapability: 'creem',
    creemEnvironment: 'sandbox',
    creemProductIds: '',
  });
  assert.equal('status' in settings, false);
  assert.equal('missing' in settings, false);
  assert.equal('requiredSecrets' in settings, false);
});

test('build public UI settings come from source-controlled site capabilities', () => {
  const settings = readBuildPublicUiConfig();

  assert.equal(settings.aiEnabled, Boolean(site.capabilities.ai));
  assert.equal(settings.localeSwitcherEnabled, false);
  assert.equal(settings.socialLinksEnabled, false);
  assert.equal(settings.socialLinksJson, '');
  assert.deepEqual(settings.socialLinks, []);
});

test('pricing display config is read from the selected site pricing config', () => {
  const pricing = readBuildPricingDisplayConfig();
  const sourcePricing = JSON.parse(
    readRepoFile('sites', site.key, 'pricing.json')
  );

  assert.deepEqual(pricing, sourcePricing);
  assert.equal(
    pricing?.pricing?.items?.[0]?.product_id,
    sourcePricing.pricing.items[0].product_id
  );
});

test('current build billing reader follows source-controlled site capability only', () => {
  const settings = readBuildBillingUiSettings();

  assert.equal(settings.paymentCapability, site.capabilities.payment);
  assert.equal(settings.provider, site.capabilities.payment);
});
