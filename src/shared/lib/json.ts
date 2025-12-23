export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type JsonObject = {
  [key: string]: JsonValue;
};

function toJsonFunctionLabel(value: (...args: never[]) => unknown): string {
  return value.name ? `[Function: ${value.name}]` : '[Function]';
}

function toJsonValueInternal(value: unknown, seen: WeakSet<object>): JsonValue {
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'boolean':
      return value;
    case 'bigint':
      return value.toString();
    case 'undefined':
      return null;
    case 'symbol':
      return value.toString();
    case 'function':
      return toJsonFunctionLabel(value as (...args: never[]) => unknown);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValueInternal(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    const record = value as Record<string, unknown>;
    const result: JsonObject = {};

    for (const [key, item] of Object.entries(record)) {
      result[key] = toJsonValueInternal(item, seen);
    }

    return result;
  }

  return String(value);
}

export function toJsonValue(value: unknown): JsonValue {
  return toJsonValueInternal(value, new WeakSet());
}

export function toJsonObject(value: unknown): JsonObject {
  const json = toJsonValue(value);
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    return json as JsonObject;
  }
  return {};
}
