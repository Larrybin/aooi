import {
  isCiEnv as readCiEnv,
  isDebugEnv as readDebugEnv,
  isProductionEnv as readProductionEnv,
  type EnvLike,
} from '@/config/env-contract';

export function isProductionEnv(env?: EnvLike): boolean {
  return readProductionEnv(env);
}

export function isCiEnv(env?: EnvLike): boolean {
  return readCiEnv(env);
}

export function isDebugEnv(env?: EnvLike): boolean {
  return readDebugEnv(env);
}

export const isProduction = isProductionEnv();

export const isCloudflareWorker =
  typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis;
