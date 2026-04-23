function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('STORAGE_PUBLIC_BASE_URL must not be empty');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (error: unknown) {
    throw new Error(
      `STORAGE_PUBLIC_BASE_URL must be a valid URL (got: ${trimmed}, error: ${String(error)})`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `STORAGE_PUBLIC_BASE_URL must use http/https (got: ${trimmed})`
    );
  }

  const normalizedPath = url.pathname.replace(/\/+$/, '');
  url.pathname = normalizedPath ? `${normalizedPath}/` : '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function isStorageObjectKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !trimmed.startsWith('/') && !isAbsoluteHttpUrl(trimmed);
}

export function normalizeStoragePublicBaseUrl(
  value: string
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: '' };
  }

  try {
    return {
      ok: true,
      value: normalizeBaseUrl(trimmed),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'STORAGE_PUBLIC_BASE_URL is invalid',
    };
  }
}

export function buildStorageObjectPublicUrl(
  objectKey: string,
  storagePublicBaseUrl: string
): string {
  const normalizedKey = objectKey.replace(/^\/+/, '').trim();
  if (!normalizedKey) {
    throw new Error('storage object key must not be empty');
  }

  return new URL(normalizedKey, normalizeBaseUrl(storagePublicBaseUrl)).toString();
}

export function resolveStoredAssetUrl({
  value,
  storagePublicBaseUrl,
}: {
  value: string;
  storagePublicBaseUrl?: string;
}): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:') ||
    isAbsoluteHttpUrl(trimmed)
  ) {
    return trimmed;
  }

  if (!storagePublicBaseUrl?.trim()) {
    return '';
  }

  try {
    return buildStorageObjectPublicUrl(trimmed, storagePublicBaseUrl);
  } catch {
    return '';
  }
}
