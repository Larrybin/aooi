import 'server-only';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const STRIPE_PAYMENT_METHODS = new Set(['card', 'wechat_pay', 'alipay']);

function normalizeJson(value: unknown): string {
  return JSON.stringify(value);
}

function normalizeStringList(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function parseStripePaymentMethodsConfig(value: string): {
  ok: true;
  methods: string[];
  normalized: string;
} | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    const methods = ['card'];
    return { ok: true, methods, normalized: normalizeJson(methods) };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    parsed = trimmed.split(',').map((v) => v.trim());
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'stripe_payment_methods must be a JSON array of strings',
    };
  }

  const methods = normalizeStringList(
    parsed.filter((v): v is string => typeof v === 'string')
  ).filter((m) => STRIPE_PAYMENT_METHODS.has(m));

  if (methods.length === 0) {
    const fallback = ['card'];
    return { ok: true, methods: fallback, normalized: normalizeJson(fallback) };
  }

  return { ok: true, methods, normalized: normalizeJson(methods) };
}

export function parseCreemProductIdsMappingConfig(value: string): {
  ok: true;
  mapping: Record<string, string>;
  normalized: string;
} | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, mapping: {}, normalized: '' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: 'creem_product_ids must be valid JSON' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'creem_product_ids must be a JSON object' };
  }

  const mapping: Record<string, string> = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (typeof val !== 'string') {
      return {
        ok: false,
        error: 'creem_product_ids values must be strings',
      };
    }
    const k = key.trim();
    const v = val.trim();
    if (!k || !v) continue;
    mapping[k] = v;
  }

  return { ok: true, mapping, normalized: normalizeJson(mapping) };
}

