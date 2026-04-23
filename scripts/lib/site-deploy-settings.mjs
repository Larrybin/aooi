import { readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveRequiredSiteKey } from './site-config.mjs';

export const SITE_DEPLOY_SETTING_KEYS = Object.freeze([
  'google_auth_enabled',
  'github_auth_enabled',
  'stripe_enabled',
  'creem_enabled',
  'paypal_enabled',
  'general_ai_enabled',
]);

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

export function validateSiteDeploySettings(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('site deploy settings must be an object');
  }

  const keys = Object.keys(config).sort();
  const expectedKeys = [...SITE_DEPLOY_SETTING_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `site deploy settings must contain exactly: ${expectedKeys.join(', ')}`
    );
  }

  for (const key of SITE_DEPLOY_SETTING_KEYS) {
    assertBoolean(config[key], `site deploy settings.${key}`);
  }
}

export function resolveSiteDeploySettingsPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'deploy.settings.json');
}

export function readSiteDeploySettings({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const sourcePath = resolveSiteDeploySettingsPath({ rootDir, siteKey });
  const raw = readFileSync(sourcePath, 'utf8');
  const config = JSON.parse(raw);

  validateSiteDeploySettings(config);
  return config;
}
