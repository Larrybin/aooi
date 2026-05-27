const strictForbiddenPageTypes = new Set([
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
]);
const warningForbiddenPageTypes = new Set(['admin', 'auth']);
const englishWordPattern = /\b[A-Za-z][A-Za-z0-9]*(?:[-'][A-Za-z0-9]+)*\b/g;
const htmlEntityReplacements = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['copy', ' '],
  ['gt', '>'],
  ['lt', '<'],
  ['mdash', ' '],
  ['nbsp', ' '],
  ['ndash', ' '],
  ['quot', '"'],
  ['reg', ' '],
  ['trade', ' '],
]);

function normalizeTerm(value) {
  return value.trim().toLocaleLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createStandaloneTermPattern(term) {
  return new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`,
    'gi'
  );
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
  const normalizedText = normalizeTerm(text);

  return collectForbiddenTerms(glossary, locale)
    .filter((term) => normalizedText.includes(normalizeTerm(term)))
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

function removePreservedTerms(text, preservedTerms) {
  const orderedTerms = preservedTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  return orderedTerms.reduce((remainingText, term) => {
    return remainingText.replace(createStandaloneTermPattern(term), ' ');
  }, text);
}

function decodeHtmlEntity(entity) {
  const normalizedEntity = entity.toLocaleLowerCase();
  if (normalizedEntity.startsWith('#x')) {
    return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(2), 16));
  }

  if (normalizedEntity.startsWith('#')) {
    return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10));
  }

  return htmlEntityReplacements.get(normalizedEntity) ?? ' ';
}

function decodeHtmlEntities(text) {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[A-Za-z][A-Za-z0-9]+);/gi,
    (_, entity) => decodeHtmlEntity(entity)
  );
}

function findClosingBrace(text, openIndex) {
  let depth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    }

    if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function collectIcuBranchText(block) {
  let branchText = '';

  for (let index = 0; index < block.length; index += 1) {
    if (block[index] !== '{') {
      continue;
    }

    const closingBrace = findClosingBrace(block, index);
    if (closingBrace < 0) {
      break;
    }

    branchText += ` ${stripIcuMessageSyntax(
      block.slice(index + 1, closingBrace)
    )} `;
    index = closingBrace;
  }

  return branchText || ' ';
}

function stripIcuBlock(block) {
  const trimmedBlock = block.trim();

  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmedBlock)) {
    return ' ';
  }

  if (
    /^[A-Za-z][A-Za-z0-9_]*\s*,\s*(?:plural|select|selectordinal|number|date|time)\b/.test(
      trimmedBlock
    )
  ) {
    return collectIcuBranchText(block);
  }

  return stripIcuMessageSyntax(block);
}

function stripIcuMessageSyntax(text) {
  let strippedText = '';

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') {
      strippedText += text[index];
      continue;
    }

    const closingBrace = findClosingBrace(text, index);
    if (closingBrace < 0) {
      strippedText += text[index];
      continue;
    }

    strippedText += stripIcuBlock(text.slice(index + 1, closingBrace));
    index = closingBrace;
  }

  return strippedText;
}

function removeIcuPlaceholders(text) {
  return stripIcuMessageSyntax(text);
}

function isMarkupTag(tagText) {
  return /^\/?[A-Za-z][A-Za-z0-9:-]*(?:\s|\/|$)/.test(tagText.trim());
}

function stripMarkupSyntax(text) {
  let strippedText = '';

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '<') {
      strippedText += text[index];
      continue;
    }

    const tagEnd = text.indexOf('>', index + 1);
    if (tagEnd < 0 || !isMarkupTag(text.slice(index + 1, tagEnd))) {
      strippedText += text[index];
      continue;
    }

    strippedText += ' ';
    index = tagEnd;
  }

  return strippedText;
}

export function findEnglishResiduals({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  const textWithoutPreservedTerms = removePreservedTerms(
    stripMarkupSyntax(removeIcuPlaceholders(decodeHtmlEntities(text))),
    glossary.preserve
  );
  const issues = [];
  const seenTerms = new Set();

  for (const match of textWithoutPreservedTerms.matchAll(englishWordPattern)) {
    const term = match[0];
    const normalizedTerm = normalizeTerm(term);
    if (seenTerms.has(normalizedTerm)) {
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
