import type { EntitlementValue } from './types';

export type EntitlementValueType = 'number' | 'boolean' | 'string';
export type EntitlementMergeMode = 'max' | 'override';

export type EntitlementFieldSchema = {
  type: EntitlementValueType;
  merge: EntitlementMergeMode;
};

export type ProductEntitlementSchema = Record<string, EntitlementFieldSchema>;

const PRODUCT_ENTITLEMENT_SCHEMAS: Record<string, ProductEntitlementSchema> = {
  'ai-remover': {
    monthly_removals: { type: 'number', merge: 'max' },
    monthly_high_res_downloads: { type: 'number', merge: 'max' },
    max_upload_mb: { type: 'number', merge: 'max' },
  },
};

export function getProductEntitlementSchema(productKey: string) {
  return PRODUCT_ENTITLEMENT_SCHEMAS[productKey];
}

export function assertEntitlementValueMatchesSchema({
  key,
  value,
  field,
}: {
  key: string;
  value: EntitlementValue;
  field: EntitlementFieldSchema;
}) {
  if (typeof value !== field.type) {
    throw new Error(`entitlement ${key} must be a ${field.type}`);
  }
}
