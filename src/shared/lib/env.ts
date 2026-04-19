import {
  isCiEnv as readCiEnv,
  isDebugEnv as readDebugEnv,
  isProductionEnv as readProductionEnv,
} from '@/config/env-contract';

export function isProductionEnv(env?: NodeJS.ProcessEnv): boolean {
  return readProductionEnv(env);
}

export function isCiEnv(env?: NodeJS.ProcessEnv): boolean {
  return readCiEnv(env);
}

export function isDebugEnv(env?: NodeJS.ProcessEnv): boolean {
  return readDebugEnv(env);
}

export const isProduction = isProductionEnv();

export const isCloudflareWorker =
  typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis;
