import * as ts from 'typescript';

const strictForbiddenPageTypes = new Set([
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
]);
const warningForbiddenPageTypes = new Set(['admin', 'auth']);
const englishWordPattern = /\b[A-Za-z][A-Za-z0-9]*(?:[-'][A-Za-z0-9]+)*\b/g;
const visibleAttributeNames = new Set([
  'aria-label',
  'alt',
  'placeholder',
  'title',
]);
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

function includesI18nExemptReason(line) {
  return /i18n-exempt:\s*\S+/.test(line);
}

function getLineNumberAtIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
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

function normalizeVisibleText(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

function hasExemptReasonInRange({ lines, content, start, end }) {
  const startLine = getLineNumberAtIndex(content, start);
  const endLine = getLineNumberAtIndex(content, end);
  return lines.slice(startLine - 1, endLine).some(includesI18nExemptReason);
}

function pushHardcodedVisibleEnglishIssue({
  issues,
  filePath,
  content,
  lines,
  start,
  end,
  text,
}) {
  const normalizedText = normalizeVisibleText(text);
  if (!/[A-Za-z]/.test(normalizedText)) {
    return;
  }

  if (hasExemptReasonInRange({ lines, content, start, end })) {
    return;
  }

  issues.push({
    code: 'i18n_hardcoded_visible_english',
    severity: 'error',
    filePath,
    line: getLineNumberAtIndex(content, start),
    text: normalizedText,
  });
}

function isTranslationCallee(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text === 't';
  }

  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 't' &&
    ['rich', 'markup', 'raw'].includes(expression.name.text)
  );
}

function collectVisibleAttributeTextSegments(expression, sourceFile) {
  const segments = [];

  function visit(node) {
    if (ts.isCallExpression(node) && isTranslationCallee(node.expression)) {
      for (const argument of node.arguments.slice(1)) {
        visit(argument);
      }
      return;
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      segments.push({
        text: node.text,
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
      return;
    }

    if (ts.isTemplateExpression(node)) {
      if (node.head.text) {
        segments.push({
          text: node.head.text,
          start: node.head.getStart(sourceFile),
          end: node.head.getEnd(),
        });
      }

      for (const span of node.templateSpans) {
        if (!span.literal.text) {
          continue;
        }

        segments.push({
          text: span.literal.text,
          start: span.literal.getStart(sourceFile),
          end: span.literal.getEnd(),
        });
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(expression);
  return segments;
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

export function findHardcodedVisibleEnglish({ filePath, content }) {
  const textIssues = [];
  const attributeIssues = [];
  const lines = content.split(/\r?\n/);
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node) {
    if (ts.isJsxText(node)) {
      pushHardcodedVisibleEnglishIssue({
        issues: textIssues,
        filePath,
        content,
        lines,
        start: node.pos,
        end: node.end,
        text: node.getText(sourceFile),
      });
    }

    if (
      ts.isJsxAttribute(node) &&
      visibleAttributeNames.has(node.name.getText(sourceFile)) &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) {
        pushHardcodedVisibleEnglishIssue({
          issues: attributeIssues,
          filePath,
          content,
          lines,
          start: node.initializer.getStart(sourceFile),
          end: node.initializer.getEnd(),
          text: node.initializer.text,
        });
      }

      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        for (const segment of collectVisibleAttributeTextSegments(
          node.initializer.expression,
          sourceFile
        )) {
          pushHardcodedVisibleEnglishIssue({
            issues: attributeIssues,
            filePath,
            content,
            lines,
            start: segment.start,
            end: segment.end,
            text: segment.text,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...textIssues, ...attributeIssues];
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
