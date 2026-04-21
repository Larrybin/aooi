import { createElement } from 'react';
import { docs } from '@/.source';
import type { I18nConfig } from 'fumadocs-core/i18n';
import { createFromSource } from 'fumadocs-core/search/server';
import { loader } from 'fumadocs-core/source';
import { icons } from 'lucide-react';

import { toLoaderSource } from '@/domains/content/infra/source';

// 针对搜索单独使用英文索引，避免 Orama 多语言兼容问题
const searchI18n: I18nConfig = {
  defaultLanguage: 'en',
  languages: ['en'],
};

const searchSource = loader({
  baseUrl: '/docs',
  source: toLoaderSource(docs.toFumadocsSource()),
  i18n: searchI18n,
  icon(iconName) {
    if (!iconName) return;

    if (!Object.prototype.hasOwnProperty.call(icons, iconName)) {
      return;
    }

    return createElement(icons[iconName as keyof typeof icons]);
  },
});

export const { GET } = createFromSource(searchSource, {
  language: 'english',
});
