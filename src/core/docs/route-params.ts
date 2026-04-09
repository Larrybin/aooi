export function normalizeDocsSlug(slug?: string[]) {
  const normalizedSlug = (slug ?? []).filter(Boolean);

  if (normalizedSlug.length === 1 && normalizedSlug[0] === 'index') {
    return [];
  }

  return normalizedSlug;
}

const supportedDocsLocales = new Set(['en', 'zh']);

export function resolveDocsLocale(locale?: string) {
  if (!locale) {
    return 'en';
  }

  return supportedDocsLocales.has(locale) ? locale : 'en';
}
