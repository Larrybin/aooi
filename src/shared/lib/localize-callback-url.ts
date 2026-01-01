export function localizeCallbackUrl({
  callbackUrl,
  locale,
  defaultLocale,
}: {
  callbackUrl: string;
  locale: string;
  defaultLocale: string;
}): string {
  if (!callbackUrl) return callbackUrl;
  if (locale === defaultLocale) return callbackUrl;
  if (!callbackUrl.startsWith('/')) return callbackUrl;
  if (callbackUrl.startsWith(`/${locale}`)) return callbackUrl;
  return `/${locale}${callbackUrl}`;
}
