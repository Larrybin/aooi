import { createFromSource } from 'fumadocs-core/search/server';

import { createDocsSearchSource } from '@/domains/content/application/docs-content.query';

export const { GET } = createFromSource(createDocsSearchSource(), {
  language: 'english',
});
