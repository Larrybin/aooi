import { createDocsSearchSource } from '@/domains/content/application/docs-content.query';
import { createFromSource } from 'fumadocs-core/search/server';

export const { GET } = createFromSource(createDocsSearchSource(), {
  language: 'english',
});
