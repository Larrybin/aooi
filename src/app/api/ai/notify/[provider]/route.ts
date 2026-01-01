import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { AiNotifyParamsSchema } from '@/shared/schemas/api/ai/notify';

export const POST = withApi(
  async (
    req: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const api = createApiContext(req);
    const { log } = api;
    const { provider } = await api.parseParams(params, AiNotifyParamsSchema);

    const contentType = req.headers.get('content-type') || null;
    const contentLengthHeader = req.headers.get('content-length') || null;

    let bodySize: number | null = null;
    try {
      const raw = await req.text();
      bodySize = raw.length;
    } catch (error: unknown) {
      log.warn('ai: notify body read failed', { provider, error });
    }

    log.info('ai: notify received', {
      provider,
      contentType,
      contentLengthHeader,
      bodySize,
    });

    // Always ack 2xx to avoid upstream marking callback as failed.
    return jsonOk({ ok: true });
  }
);
