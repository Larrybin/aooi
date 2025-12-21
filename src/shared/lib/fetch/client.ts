'use client';

import { sanitizeUrlForLog } from '@/shared/lib/fetch/sanitize-url';
import { fetchWithTimeout } from '@/shared/lib/fetch/timeout';

export async function fetchBlobWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit
): Promise<Blob> {
  const response = await fetchWithTimeout(url, init, { timeoutMs });
  if (!response.ok) {
    const safeUrl = sanitizeUrlForLog(url);
    throw new Error(`download failed: ${response.status} ${safeUrl}`);
  }
  return await response.blob();
}
