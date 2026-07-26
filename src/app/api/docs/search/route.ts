import { createDocsSearchSource } from '@/domains/content/application/docs-content.query';
import { getSite } from '@/infra/platform/site';
import { createFromSource } from 'fumadocs-core/search/server';

import { NotFoundError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';

const docsSearchApi = createFromSource(createDocsSearchSource(), {
  language: 'english',
});

export const GET = withApi(async (request: Request) => {
  // Search exposes the same corpus as /docs, so it has to 404 wherever /docs does.
  if (!getSite().capabilities.docs) {
    throw new NotFoundError('not found');
  }

  return docsSearchApi.GET(request);
});
