import { tryJsonParse } from '@/shared/lib/json';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const STRIPE_PAYMENT_METHODS = new Set(['card', 'wechat_pay', 'alipay']);

function normalizeJson(value: unknown): string {
  return JSON.stringify(value);
}

function normalizeStringList(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function parseStripePaymentMethodsConfig(value: string):
  | {
      ok: true;
      methods: string[];
      normalized: string;
    }
  | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    const methods = ['card'];
    return { ok: true, methods, normalized: normalizeJson(methods) };
  }

  const parsedResult = tryJsonParse<unknown>(trimmed);
  const parsed = parsedResult.ok
    ? parsedResult.value
    : trimmed.split(',').map((item) => item.trim());

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'stripe_payment_methods must be a JSON array of strings',
    };
  }

  const methods = normalizeStringList(
    parsed.filter((item): item is string => typeof item === 'string')
  ).filter((item) => STRIPE_PAYMENT_METHODS.has(item));

  if (methods.length === 0) {
    const fallback = ['card'];
    return { ok: true, methods: fallback, normalized: normalizeJson(fallback) };
  }

  return { ok: true, methods, normalized: normalizeJson(methods) };
}

export function parseCreemProductIdsMappingConfig(value: string):
  | {
      ok: true;
      mapping: Record<string, string>;
      normalized: string;
    }
  | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, mapping: {}, normalized: '' };
  }

  const parsedResult = tryJsonParse<unknown>(trimmed);
  if (!parsedResult.ok) {
    return { ok: false, error: 'creem_product_ids must be valid JSON' };
  }

  if (!isPlainObject(parsedResult.value)) {
    return { ok: false, error: 'creem_product_ids must be a JSON object' };
  }

  const mapping: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(parsedResult.value)) {
    if (typeof rawValue !== 'string') {
      return {
        ok: false,
        error: 'creem_product_ids values must be strings',
      };
    }

    const normalizedKey = key.trim();
    const normalizedValue = rawValue.trim();
    if (!normalizedKey || !normalizedValue) continue;
    mapping[normalizedKey] = normalizedValue;
  }

  return { ok: true, mapping, normalized: normalizeJson(mapping) };
}

export function resolveCreemPaymentProductId({
  configValue,
  productId,
  checkoutCurrency,
}: {
  configValue: string | undefined;
  productId: string;
  checkoutCurrency: string;
}):
  | {
      ok: true;
      paymentProductId?: string;
    }
  | { ok: false; error: string; configLength: number } {
  if (!configValue) {
    return { ok: true };
  }

  const parsed = parseCreemProductIdsMappingConfig(configValue);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.error,
      configLength: configValue.length,
    };
  }

  return {
    ok: true,
    paymentProductId:
      parsed.mapping[`${productId}_${checkoutCurrency}`] ||
      parsed.mapping[productId],
  };
}
