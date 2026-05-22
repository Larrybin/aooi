import { mergeEntitlementsFromGrants } from '@/domains/entitlements/domain/entitlements';
import type {
  AppEnvironment,
  EffectiveEntitlements,
  EntitlementGrantRecord,
  EntitlementMap,
} from '@/domains/entitlements/domain/types';

export type ResolveEffectiveEntitlementsDeps = {
  listGrants(input: {
    userId: string;
    siteKey: string;
    productKey: string;
  }): Promise<EntitlementGrantRecord[]>;
};

export async function resolveEffectiveEntitlements({
  userId,
  siteKey,
  productKey,
  baseEntitlements,
  environment,
  internalEntitlementGrantsEnabled,
  now = new Date(),
  deps,
}: {
  userId: string;
  siteKey: string;
  productKey: string;
  baseEntitlements?: EntitlementMap;
  environment: AppEnvironment;
  internalEntitlementGrantsEnabled: boolean;
  now?: Date;
  deps: ResolveEffectiveEntitlementsDeps;
}): Promise<EffectiveEntitlements> {
  if (environment === 'production' && !internalEntitlementGrantsEnabled) {
    return {
      entitlements: { ...(baseEntitlements ?? {}) },
      grantIds: [],
    };
  }

  const grants = await deps.listGrants({
    userId,
    siteKey,
    productKey,
  });

  return mergeEntitlementsFromGrants({
    baseEntitlements,
    grants,
    environment,
    now,
    productKey,
  });
}
