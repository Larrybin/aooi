import { readBackgroundRemoverResultFile } from '@/domains/background-remover/application/result';
import { findBackgroundRemoverImageByIdForOwner } from '@/domains/background-remover/infra/image';
import { getStorageService } from '@/infra/adapters/storage/service';

import { withApi } from '@/shared/lib/api/route';

import { requireBackgroundRemoverSite } from '../../_lib/guard';
import { resolveBackgroundRemoverActor } from '../../actor.server';

function imageResponse(input: {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
}) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': input.contentType || 'image/png',
    'Content-Disposition': 'inline',
  });
  if (input.contentLength !== null) {
    headers.set('Content-Length', String(input.contentLength));
  }
  return new Response(input.body, { headers });
}

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

    return imageResponse(file);
  }
);
