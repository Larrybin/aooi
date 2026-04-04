export function normalizePublicAssetPath(
  value: string,
  envName: string
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${envName} must not be empty`);
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    throw new Error(
      `${envName} must be a public asset path starting with "/" (got remote URL: ${trimmed})`
    );
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function readPublicAssetPath(
  rawValue: string | undefined,
  fallback: string,
  envName: string
): string {
  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  return normalizePublicAssetPath(rawValue, envName);
}
