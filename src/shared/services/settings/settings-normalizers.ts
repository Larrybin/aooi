import { z } from 'zod';

import { generalSocialLinksSchema } from '@/shared/lib/general-ui.schema';
import { tryJsonParse } from '@/shared/lib/json';
import { normalizeAssetSettingValue } from '@/shared/services/settings/validators/general';
import {
  parseCreemProductIdsMappingConfig,
  parseStripePaymentMethodsConfig,
} from '@/shared/services/settings/validators/payment';

const SUPPORT_EMAIL_SCHEMA = z.string().email();

type NormalizedSettingValueResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

type SettingValueNormalizer = (value: string) => NormalizedSettingValueResult;

function normalizeRequiredText(
  value: string,
  fieldLabel: string
): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: `Invalid ${fieldLabel}. Must not be empty.`,
    };
  }

  return { ok: true, value: trimmed };
}

function normalizeAppUrl(value: string): NormalizedSettingValueResult {
  const trimmed = normalizeRequiredText(value, 'App URL');
  if (!trimmed.ok) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        error: `Invalid App URL. Must use http/https (got: ${trimmed.value}).`,
      };
    }

    return { ok: true, value: url.origin };
  } catch (error: unknown) {
    return {
      ok: false,
      error: `Invalid App URL. Must be a valid URL (got: ${trimmed.value}, error: ${String(error)}).`,
    };
  }
}

function normalizeSupportEmail(value: string): NormalizedSettingValueResult {
  const normalized = value.trim().toLowerCase();
  const result = SUPPORT_EMAIL_SCHEMA.safeParse(normalized);

  if (!result.success) {
    return {
      ok: false,
      error: 'Invalid Support Email. Must be a valid email address.',
    };
  }

  return { ok: true, value: normalized };
}

function normalizeAssetValue(
  value: string,
  fieldLabel: string,
  errorLabel: string
): NormalizedSettingValueResult {
  const result = normalizeAssetSettingValue(value, fieldLabel);
  if (!result.ok) {
    return { ok: false, error: `Invalid ${errorLabel}. ${result.error}` };
  }

  return result;
}

function formatSocialLinksIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function normalizeSocialLinks(value: string): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  const parsedResult = tryJsonParse<unknown>(trimmed);
  if (!parsedResult.ok) {
    return {
      ok: false,
      error: 'Invalid Social Links JSON. Must be valid JSON.',
    };
  }

  const result = generalSocialLinksSchema.safeParse(parsedResult.value);
  if (!result.success) {
    const issues = formatSocialLinksIssues(result.error);
    return {
      ok: false,
      error:
        `Invalid Social Links JSON. ${issues || ''} Expected an array. When enabled=true, icon and url are required.`.trim(),
    };
  }

  return { ok: true, value: JSON.stringify(result.data) };
}

function normalizeStripePaymentMethods(
  value: string
): NormalizedSettingValueResult {
  const result = parseStripePaymentMethodsConfig(value);
  if (!result.ok) {
    return {
      ok: false,
      error: `Invalid Stripe Payment Methods. ${result.error}. Expected a JSON array, e.g. ["card","alipay"].`,
    };
  }

  return { ok: true, value: result.normalized };
}

function normalizeCreemProductIds(value: string): NormalizedSettingValueResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  const result = parseCreemProductIdsMappingConfig(value);
  if (!result.ok) {
    return {
      ok: false,
      error: `Invalid Creem Product IDs Mapping. ${result.error}. Expected a JSON object, e.g. {"starter":"prod_xxx"}.`,
    };
  }

  return { ok: true, value: result.normalized };
}

const SETTING_VALUE_NORMALIZERS: Partial<
  Record<string, SettingValueNormalizer>
> = {
  app_name: (value) => normalizeRequiredText(value, 'App Name'),
  app_url: normalizeAppUrl,
  general_support_email: normalizeSupportEmail,
  app_logo: (value) => normalizeAssetValue(value, 'App Logo', 'App Logo'),
  app_favicon: (value) => normalizeAssetValue(value, 'Favicon', 'Favicon'),
  app_og_image: (value) =>
    normalizeAssetValue(value, 'Preview Image', 'Preview Image'),
  general_social_links: normalizeSocialLinks,
  stripe_payment_methods: normalizeStripePaymentMethods,
  creem_product_ids: normalizeCreemProductIds,
};

export function normalizeSettingOverrides(values: Record<string, string>) {
  const overrides: Record<string, string> = {};

  for (const [name, value] of Object.entries(values)) {
    const normalize = SETTING_VALUE_NORMALIZERS[name];
    if (!normalize) {
      continue;
    }

    const result = normalize(value);
    if (!result.ok) {
      return result;
    }

    overrides[name] = result.value;
  }

  return { ok: true, value: overrides } as const;
}
