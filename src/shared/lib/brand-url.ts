export function getBrandPreviewHost(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return 'your-domain.com';
  }

  try {
    const normalized = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    return new URL(normalized).host || 'your-domain.com';
  } catch {
    return trimmed;
  }
}
