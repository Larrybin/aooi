import { PayloadTooLargeError } from '@/shared/lib/api/errors';

export async function readRequestTextWithLimit(
  req: Request,
  limitBytes: number
): Promise<string> {
  const body = req.body;
  if (!body) return '';

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytes += value.byteLength;
      if (bytes > limitBytes) {
        try {
          await reader.cancel();
        } catch {}
        throw new PayloadTooLargeError('payload too large');
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  return text + decoder.decode();
}

export async function readRequestBodyByteCountUpTo(
  req: Request,
  maxBytes: number
): Promise<{ bytesRead: number | null; truncated: boolean }> {
  const body = req.body;
  if (!body) {
    return { bytesRead: 0, truncated: false };
  }

  const reader = body.getReader();
  let bytesRead = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

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
      } catch {}
    } else {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  return {
    bytesRead: truncated ? maxBytes : bytesRead,
    truncated,
  };
}

export async function readRequestFormData(req: Request): Promise<FormData> {
  return req.formData();
}
