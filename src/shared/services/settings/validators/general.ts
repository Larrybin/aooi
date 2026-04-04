export function normalizeAssetSettingValue(
  value: string,
  fieldName: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: '' };
  }

  if (trimmed.startsWith('/')) {
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        error: `${fieldName} must use http/https or start with "/".`,
      };
    }

    return { ok: true, value: url.toString() };
  } catch (error: unknown) {
    return {
      ok: false,
      error: `${fieldName} must be a valid absolute URL or a public path starting with "/" (got: ${trimmed}, error: ${String(error)}).`,
    };
  }
}
