import { site } from '@/site';

import { NotFoundError } from '@/shared/lib/api/errors';

export function requireBackgroundRemoverSite() {
  if (site.key === 'background-remover') {
    return;
  }

  throw new NotFoundError('not found');
}
