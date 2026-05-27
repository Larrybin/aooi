const strictForbiddenPageTypes = new Set([
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
]);
const warningForbiddenPageTypes = new Set(['admin', 'auth']);
const englishWordPattern = /\b[A-Za-z][A-Za-z0-9]*(?:[-'][A-Za-z0-9]+)*\b/g;
const visibleJsxTextPattern = />\s*([^<>{}]*[A-Za-z][^<>{}]*)\s*</g;
const visibleAttributePattern =
  /\b(?:aria-label|alt|placeholder|title)=["']([^"']*[A-Za-z][^"']*)["']/g;

function normalizeTerm(value) {
  return value.trim().toLocaleLowerCase();
}

function includesI18nExemptReason(line) {
  return /i18n-exempt:\s*\S+/.test(line);
}

function collectForbiddenTerms(glossary, locale) {
  return [
    ...(glossary.forbidden.allLocales ?? []),
    ...(glossary.forbidden[locale] ?? []),
  ];
}

function createIssue({
  code,
  severity,
  message,
  locale,
  pageId,
  pageType,
  term,
}) {
  return {
    code,
    severity,
    message,
    locale,
    pageId,
    pageType,
    term,
  };
}

export function getForbiddenSeverity(pageType) {
  if (strictForbiddenPageTypes.has(pageType)) {
    return 'error';
  }

  if (warningForbiddenPageTypes.has(pageType)) {
    return 'warning';
  }

  return 'error';
}

export function findForbiddenTerms({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  const severity = getForbiddenSeverity(pageType);

  return collectForbiddenTerms(glossary, locale)
    .filter((term) => text.includes(term))
    .map((term) =>
      createIssue({
        code: 'i18n_forbidden_term',
        severity,
        message: `forbidden term "${term}" is not allowed`,
        locale,
        pageId,
        pageType,
        term,
      })
    );
}

export function findEnglishResiduals({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  const allowedTerms = new Set(glossary.preserve.map(normalizeTerm));
  const issues = [];
  const seenTerms = new Set();

  for (const match of text.matchAll(englishWordPattern)) {
    const term = match[0];
    const normalizedTerm = normalizeTerm(term);
    if (allowedTerms.has(normalizedTerm) || seenTerms.has(normalizedTerm)) {
      continue;
    }

    seenTerms.add(normalizedTerm);
    issues.push(
      createIssue({
        code: 'i18n_english_residual',
        severity: 'error',
        message: `unapproved English residual "${term}" found`,
        locale,
        pageId,
        pageType,
        term,
      })
    );
  }

  return issues;
}

export function findHardcodedVisibleEnglish({ filePath, content }) {
  const issues = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (includesI18nExemptReason(line)) {
      return;
    }

    for (const match of line.matchAll(visibleJsxTextPattern)) {
      issues.push({
        code: 'i18n_hardcoded_visible_english',
        severity: 'error',
        filePath,
        line: index + 1,
        text: match[1].trim(),
      });
    }

    for (const match of line.matchAll(visibleAttributePattern)) {
      issues.push({
        code: 'i18n_hardcoded_visible_english',
        severity: 'error',
        filePath,
        line: index + 1,
        text: match[1].trim(),
      });
    }
  });

  return issues;
}

export function checkLocalizedText({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  return [
    ...findEnglishResiduals({ text, glossary, locale, pageId, pageType }),
    ...findForbiddenTerms({ text, glossary, locale, pageId, pageType }),
  ];
}
