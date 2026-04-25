import { createDefaultSettingsSnapshot } from '../../src/domains/settings/bootstrap.ts';

export function buildSiteBootstrapSnapshot() {
  return {
    settings: createDefaultSettingsSnapshot(),
  };
}

export function serializeSiteBootstrapSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
