import 'server-only';

export type RequestContext = {
  route: string;
  requestId: string;
  method?: string;
};

function getHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

function generateRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname || '';
  } catch {
    return '';
  }
}

/**
 * 低层工具：仅负责从 Request 提取 `{route, requestId, method}`。
 *
 * 推荐：在 Route Handler 中优先使用 `getRequestLogger(req)`，
 * 以便同时获得 `ctx`（route/requestId/method）与绑定上下文的 `log`。
 */
export function getRequestContext(req: Request): RequestContext {
  const headers = req.headers;

  const requestId =
    getHeaderValue(headers, 'x-request-id') ||
    getHeaderValue(headers, 'x-vercel-id') ||
    getHeaderValue(headers, 'cf-ray') ||
    generateRequestId();

  return {
    route: safePathname(req.url) || '',
    requestId,
    method: req.method,
  };
}
