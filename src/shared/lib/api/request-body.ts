import { PayloadTooLargeError } from './errors';

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
