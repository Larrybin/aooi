type StaticSlugParam = {
  slug: string;
};

export function getLocaleStaticParams(locales: readonly string[]) {
  return locales.map((locale) => ({ locale }));
}

export function getLocaleSlugStaticParams(
  locales: readonly string[],
  params: StaticSlugParam[]
) {
  const uniqueSlugs = Array.from(
    new Set(
      params.map((param) => param.slug.trim()).filter((slug) => slug.length > 0)
    )
  );

  return locales.flatMap((locale) =>
    uniqueSlugs.map((slug) => ({
      locale,
      slug,
    }))
  );
}
