import 'server-only';

import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { unstable_cache } from '@/shared/lib/next-cache';

import {
  buildAiRuntimeSettings,
  buildAuthUiRuntimeSettings,
  buildBillingRuntimeSettings,
  buildPublicUiConfig,
} from './settings-runtime.builders';
import type {
  AiRuntimeSettings,
  AuthServerBindings,
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from './settings-runtime.contracts';
import {
  CONFIGS_CACHE_TAG,
  PUBLIC_CONFIGS_CACHE_TAG,
  readSettingsCached,
  readSettingsFresh,
  readSettingsSafe,
} from './settings-store';

function readAuthServerBindingsFromRuntime(): AuthServerBindings {
  return {
    googleClientId: getRuntimeEnvString('GOOGLE_CLIENT_ID')?.trim() || '',
    googleClientSecret:
      getRuntimeEnvString('GOOGLE_CLIENT_SECRET')?.trim() || '',
    githubClientId: getRuntimeEnvString('GITHUB_CLIENT_ID')?.trim() || '',
    githubClientSecret:
      getRuntimeEnvString('GITHUB_CLIENT_SECRET')?.trim() || '',
  };
}

const PUBLIC_UI_CONFIG_CACHE_REVALIDATE_SECONDS = 60 * 60;

const readPublicUiConfigCachedValue = unstable_cache(
  async (): Promise<PublicUiConfig> =>
    buildPublicUiConfig(await readSettingsCached()),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: PUBLIC_UI_CONFIG_CACHE_REVALIDATE_SECONDS,
  }
);

const readAuthUiRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AuthUiRuntimeSettings> =>
    buildAuthUiRuntimeSettings(
      await readSettingsCached(),
      readAuthServerBindingsFromRuntime()
    ),
  [`${CONFIGS_CACHE_TAG}:auth-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readBillingRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<BillingRuntimeSettings> =>
    buildBillingRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:billing-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

const readAiRuntimeSettingsCachedValue = unstable_cache(
  async (): Promise<AiRuntimeSettings> =>
    buildAiRuntimeSettings(await readSettingsCached()),
  [`${CONFIGS_CACHE_TAG}:ai-runtime`],
  {
    tags: [CONFIGS_CACHE_TAG],
  }
);

export async function readPublicUiConfigCached(): Promise<PublicUiConfig> {
  return structuredClone(await readPublicUiConfigCachedValue());
}

export async function readPublicUiConfigFresh(): Promise<PublicUiConfig> {
  return buildPublicUiConfig(await readSettingsFresh());
}

export async function readPublicUiConfigSafe(): Promise<{
  config: PublicUiConfig;
  error?: Error;
}> {
  const { configs, error } = await readSettingsSafe();
  return {
    config: buildPublicUiConfig(configs),
    error,
  };
}

export async function readAuthUiRuntimeSettingsCached(): Promise<AuthUiRuntimeSettings> {
  return structuredClone(await readAuthUiRuntimeSettingsCachedValue());
}

export async function readBillingRuntimeSettingsCached(): Promise<BillingRuntimeSettings> {
  return structuredClone(await readBillingRuntimeSettingsCachedValue());
}

export async function readBillingRuntimeSettingsFresh(): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readSettingsFresh());
}

export async function readAiRuntimeSettingsCached(): Promise<AiRuntimeSettings> {
  return structuredClone(await readAiRuntimeSettingsCachedValue());
}

export async function readAiRuntimeSettingsFresh(): Promise<AiRuntimeSettings> {
  return buildAiRuntimeSettings(await readSettingsFresh());
}
