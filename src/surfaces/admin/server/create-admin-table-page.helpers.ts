type SearchParamInput = Record<
  string,
  string | string[] | number | boolean | null | undefined
>;

type AdminTabConfig<TQuery extends Record<string, unknown>> = {
  name: string;
  titleKey: string;
  queryPatch?: Partial<TQuery>;
};

function firstSearchParamValue(value: SearchParamInput[string]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function normalizeAdminSearchParams(
  searchParams: SearchParamInput | undefined
): Record<string, string | undefined> {
  if (!searchParams) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(searchParams).map(([key, value]) => {
      const current = firstSearchParamValue(value);

      if (current == null) {
        return [key, undefined];
      }

      return [key, String(current)];
    })
  );
}

function isEmptyQueryValue(value: unknown) {
  return (
    typeof value === 'undefined' ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function toQueryParamValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

export function buildAdminQueryUrl(
  currentSearchParams: Record<string, string | undefined>,
  queryPatch: Record<string, unknown> | undefined,
  keysToClear: string[] = []
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(currentSearchParams)) {
    if (
      isEmptyQueryValue(value) ||
      key === 'page' ||
      keysToClear.includes(key)
    ) {
      continue;
    }

    params.set(key, String(value));
  }

  for (const [key, value] of Object.entries(queryPatch ?? {})) {
    if (isEmptyQueryValue(value)) {
      params.delete(key);
      continue;
    }

    params.set(key, toQueryParamValue(value));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

function getTabMatchKeys<TQuery extends Record<string, unknown>>(
  tabs: Array<AdminTabConfig<TQuery>>
) {
  return Array.from(
    new Set(
      tabs.flatMap(
        (tab) =>
          Object.keys(tab.queryPatch ?? {}) as Array<keyof TQuery & string>
      )
    )
  );
}

export function isAdminTabActive<TQuery extends Record<string, unknown>>(
  query: TQuery,
  tabs: Array<AdminTabConfig<TQuery>>,
  tab: AdminTabConfig<TQuery>
) {
  const matchKeys = getTabMatchKeys(tabs);

  return matchKeys.every((key) => {
    const currentValue = query[key];
    const expectedValue = tab.queryPatch?.[key];

    return currentValue === expectedValue;
  });
}
