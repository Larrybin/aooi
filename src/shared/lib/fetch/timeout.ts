type TimeoutOptions = {
  timeoutMs: number;
};

function attachAbortListener(signal: AbortSignal, onAbort: () => void) {
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: TimeoutOptions
): Promise<Response> {
  const timeoutMs = Math.max(0, options.timeoutMs);

  if (!timeoutMs) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const externalSignal = init?.signal;

  const cleanupExternal = externalSignal
    ? attachAbortListener(externalSignal, () => controller.abort())
    : () => {};

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    cleanupExternal();
  }
}
