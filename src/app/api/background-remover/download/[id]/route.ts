import { readBackgroundRemoverResultFile } from '@/domains/background-remover/application/result';
import { findBackgroundRemoverImageByIdForOwner } from '@/domains/background-remover/infra/image';
import { getStorageService } from '@/infra/adapters/storage/service';

import { withApi } from '@/shared/lib/api/route';

import { requireBackgroundRemoverSite } from '../../_lib/guard';
import { resolveBackgroundRemoverActor } from '../../actor.server';

export const GET = withApi(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    requireBackgroundRemoverSite();
    const { id } = await context.params;
    const actor = await resolveBackgroundRemoverActor(req);
    const file = await readBackgroundRemoverResultFile({
      actor,
      id,
      deps: {
        findImageByIdForOwner: findBackgroundRemoverImageByIdForOwner,
        storageService: await getStorageService(),
      },
    });
    const filename = `background-remover-${file.image.id}.png`;
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Content-Type': file.contentType || 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    if (file.contentLength !== null) {
      headers.set('Content-Length', String(file.contentLength));
    }

    return new Response(file.body, { headers });
  }
);
