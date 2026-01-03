import { createApiContext } from '@/shared/lib/api/context';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { AiNotifyParamsSchema } from '@/shared/schemas/api/ai/notify';

const MAX_AI_NOTIFY_BODY_BYTES = 64 * 1024;

async function readBodyByteCountUpTo(
  req: Request,
  maxBytes: number
): Promise<{ bytesRead: number | null; truncated: boolean }> {
  const body = req.body;
  if (!body) return { bytesRead: 0, truncated: false };

  const reader = body.getReader();
  let bytesRead = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        truncated = true;
        break;
      }
    }
  } catch {
    return { bytesRead: null, truncated: false };
  } finally {
    if (truncated) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    } else {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  }

  return { bytesRead: truncated ? maxBytes : bytesRead, truncated };
}

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

    let bodyBytesRead: number | null = null;
    let truncated = false;
    try {
      const result = await readBodyByteCountUpTo(req, MAX_AI_NOTIFY_BODY_BYTES);
      bodyBytesRead = result.bytesRead;
      truncated = result.truncated;
    } catch (error: unknown) {
      log.warn('ai: notify body read failed', { provider, error });
    }

    log.info('ai: notify received', {
      provider,
      contentType,
      contentLengthHeader,
      bodyBytesRead,
      truncated,
      maxBodyBytes: MAX_AI_NOTIFY_BODY_BYTES,
    });

    // Always ack 2xx to avoid upstream marking callback as failed.
    return jsonOk({ ok: true });
  }
);
