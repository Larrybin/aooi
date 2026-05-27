import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { checkLocalizedText } from './site-i18n-content-gates.mjs';

const nonVisibleJsonKeys = new Set([
  'amount',
  'checkout_enabled',
  'currency',
  'entitlements',
  'icon',
  'id',
  'interval',
  'is_featured',
  'price',
  'product_id',
  'product_name',
  'show_email',
  'show_locale',
  'show_signout',
  'show_trigger',
  'signout_callback',
  'src',
  'target',
  'url',
  'variant',
]);

function collectStringValues(value, values = []) {
  if (typeof value === 'string') {
    values.push(value);
    return values;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, values);
    }
    return values;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (nonVisibleJsonKeys.has(key)) {
        continue;
      }
      collectStringValues(item, values);
    }
  }

  return values;
}

function readJsonText(filePath, selector = (value) => value) {
  const content = JSON.parse(readFileSync(filePath, 'utf8'));
  return collectStringValues(selector(content)).join('\n');
}

function stripMarkdownLinkUrls(text) {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function readMdxText(filePath) {
  const text = readFileSync(filePath, 'utf8');
  if (!text.startsWith('---')) {
    return stripMarkdownLinkUrls(text);
  }

  const frontmatterEnd = text.indexOf('\n---', 3);
  if (frontmatterEnd < 0) {
    return stripMarkdownLinkUrls(text);
  }

  const frontmatter = text
    .slice(3, frontmatterEnd)
    .split('\n')
    .map((line) => line.match(/^[A-Za-z0-9_-]+:\s*(.+)$/)?.[1] ?? '')
    .filter(Boolean)
    .join('\n');
  const body = text.slice(frontmatterEnd + '\n---'.length);

  return stripMarkdownLinkUrls(`${frontmatter}\n${body}`);
}

function localizeRelativePath(sourcePath, locale) {
  const extension = path.extname(sourcePath);
  return `${sourcePath.slice(0, -extension.length)}.${locale}${extension}`;
}

function readAdminLocaleMessages(rootDir, locale) {
  const adminDir = path.resolve(
    rootDir,
    'src/config/locale/messages',
    locale,
    'admin'
  );
  if (!existsSync(adminDir)) {
    return null;
  }

  return readdirSync(adminDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => readJsonText(path.resolve(adminDir, entry.name)))
    .join('\n');
}

function resolveLocalizedText({ rootDir, siteKey, page, locale }) {
  const siteDir = path.resolve(rootDir, 'sites', siteKey);

  if (page.pageId === 'home') {
    const filePath = path.resolve(siteDir, 'content', `home.${locale}.json`);
    return existsSync(filePath) ? readJsonText(filePath) : null;
  }

  if (page.pageId === 'pricing') {
    const filePath = path.resolve(siteDir, `pricing.${locale}.json`);
    return existsSync(filePath) ? readJsonText(filePath) : null;
  }

  if (page.source.kind === 'site-content') {
    const filePath = path.resolve(
      siteDir,
      localizeRelativePath(page.source.path, locale)
    );
    return existsSync(filePath) ? readMdxText(filePath) : null;
  }

  if (page.pageId === 'product.my-images') {
    const filePath = path.resolve(
      rootDir,
      'src/config/locale/messages',
      locale,
      'common.json'
    );
    return existsSync(filePath)
      ? readJsonText(filePath, (messages) => messages.my_images ?? {})
      : null;
  }

  if (page.type === 'auth') {
    const filePath = path.resolve(
      rootDir,
      'src/config/locale/messages',
      locale,
      'common.json'
    );
    return existsSync(filePath)
      ? readJsonText(filePath, (messages) => messages.sign ?? {})
      : null;
  }

  if (page.pageId === 'admin.index') {
    return readAdminLocaleMessages(rootDir, locale);
  }

  return null;
}

function createMissingAssetIssue({ locale, page }) {
  return {
    code: 'i18n_localized_content_missing',
    severity: 'error',
    message: 'localized content asset is missing or not mapped',
    locale,
    pageId: page.pageId,
    pageType: page.type,
    path: page.path,
  };
}

function withPagePath(issue, page) {
  return {
    ...issue,
    path: page.path,
  };
}

export function buildLocalizedContentIssues({
  rootDir = process.cwd(),
  siteKey,
  site,
  pages,
  manifest,
  glossary,
}) {
  const issues = [];
  const targetLocales = site.i18n.supportedLocales.filter(
    (locale) => locale !== site.i18n.defaultLocale
  );

  for (const locale of targetLocales) {
    for (const page of pages.pages) {
      if (!manifest.locales[locale]?.[page.pageId]) {
        continue;
      }

      const text = resolveLocalizedText({ rootDir, siteKey, page, locale });
      if (text === null) {
        issues.push(createMissingAssetIssue({ locale, page }));
        continue;
      }

      issues.push(
        ...checkLocalizedText({
          text,
          glossary,
          locale,
          pageId: page.pageId,
          pageType: page.type,
        }).map((issue) => withPagePath(issue, page))
      );
    }
  }

  return issues;
}
