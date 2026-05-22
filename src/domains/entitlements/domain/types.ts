export const APP_ENVIRONMENTS = [
  'local',
  'preview',
  'staging',
  'production',
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

export type EntitlementValue = string | number | boolean;
export type EntitlementMap = Record<string, EntitlementValue>;

export type EntitlementGrantStatus = 'active' | 'revoked';

export type EntitlementGrantSource =
  | 'billing'
  | 'manual_grant'
  | 'internal_test';

export type EntitlementGrantRecord = {
  id: string;
  userId: string;
  siteKey: string;
  productKey: string;
  environment: string;
  source: string;
  status: string;
  entitlementsJson: string;
  reason: string;
  grantedByUserId: string | null;
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

export type EffectiveEntitlements = {
  entitlements: EntitlementMap;
  grantIds: string[];
};
