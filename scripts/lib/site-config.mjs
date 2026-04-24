import { readFileSync } from 'node:fs';
import path from 'node:path';

import { validateSiteConfig } from '../site-schema.mjs';

export const TEST_SITE_KEY = 'dev-local';

export function resolveRequiredSiteKey(env = process.env) {
  const siteKey = env.SITE?.trim();
  if (!siteKey) {
    throw new Error(
      'SITE is required. Use an explicit site key such as SITE=mamamiya or SITE=dev-local.'
    );
  }

  return siteKey;
}

export function resolveSiteConfigPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'site.config.json');
}

export function readCurrentSiteConfig({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const sourcePath = resolveSiteConfigPath({ rootDir, siteKey });
  const raw = readFileSync(sourcePath, 'utf8');
  const site = JSON.parse(raw);

  validateSiteConfig(site);
  if (site.key !== siteKey) {
    throw new Error(
      `site config key mismatch: expected "${siteKey}" but found "${site.key}" in sites/${siteKey}/site.config.json`
    );
  }
  return site;
}
