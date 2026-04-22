import 'server-only';

import {
  readSettingsCached,
  readSettingsFresh,
  readSettingsSafe,
  type Configs,
} from './settings-store';

export type { Configs };

export async function readRuntimeSettingsCached(): Promise<Configs> {
  return await readSettingsCached();
}

export async function readRuntimeSettingsFresh(): Promise<Configs> {
  return await readSettingsFresh();
}

export async function readRuntimeSettingsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  const { configs, error } = await readSettingsSafe();

  return {
    configs,
    error,
  };
}
