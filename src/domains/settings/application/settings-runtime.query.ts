import 'server-only';

import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';

import {
  readSettingsCached,
  readSettingsFresh,
  readSettingsSafe,
  type Configs,
} from './settings-store';

export type { Configs };

export async function readRuntimeSettingsCached(): Promise<Configs> {
  const dbConfigs = await readSettingsCached();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  // DB settings intentionally override deploy-time public env values.
  return {
    ...serverPublicEnvConfigs,
    ...dbConfigs,
  };
}

export async function readRuntimeSettingsFresh(): Promise<Configs> {
  const dbConfigs = await readSettingsFresh();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  return {
    ...serverPublicEnvConfigs,
    ...dbConfigs,
  };
}

export async function readRuntimeSettingsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  const { configs: dbConfigs, error } = await readSettingsSafe();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  return {
    configs: {
      ...serverPublicEnvConfigs,
      ...dbConfigs,
    },
    error,
  };
}
