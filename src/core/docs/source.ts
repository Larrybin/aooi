// .source folder will be generated when you run `next dev`
import { createElement } from 'react';
import { docs, pages, posts } from '@/.source';
import type { I18nConfig } from 'fumadocs-core/i18n';
import { loader, type Source, type SourceConfig } from 'fumadocs-core/source';
import { icons } from 'lucide-react';

export const i18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en', 'zh'],
};

const iconHelper = (icon: string | undefined) => {
  if (!icon) {
    // You may set a default icon
    return;
  }
  if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
};

export const toLoaderSource = <Config extends SourceConfig>(
  input: Source<Config>
): Source<Config> => {
  if (!input || typeof input !== 'object' || !('files' in input)) {
    return { files: [] } as Source<Config>;
  }

  const inputWithFiles = input as { files: unknown };
  const files =
    typeof inputWithFiles.files === 'function'
      ? (inputWithFiles.files as () => unknown)()
      : inputWithFiles.files;
  return { files } as Source<Config>;
};

// Docs source
export const docsSource = loader({
  baseUrl: '/docs',
  source: toLoaderSource(docs.toFumadocsSource()),
  i18n,
  icon: iconHelper,
});

// Pages source (using root path)
export const pagesSource = loader({
  baseUrl: '/',
  source: toLoaderSource(pages.toFumadocsSource()),
  i18n,
  icon: iconHelper,
});

// Posts source
export const postsSource = loader({
  baseUrl: '/blog',
  source: toLoaderSource(posts.toFumadocsSource()),
  i18n,
  icon: iconHelper,
});

// Keep backward compatibility
export const source = docsSource;
