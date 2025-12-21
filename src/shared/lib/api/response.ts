/**
 * Usage:
 * - Use `jsonOk` / `jsonErr` in Route Handlers (especially in wrappers).
 * - Response JSON structure matches legacy `{code,message,data}`; only HTTP status changes.
 * - Note: legacy `src/shared/lib/resp.ts` has been removed; keep response helpers unified here.
 */

export type ApiOkEnvelope = {
  code: 0;
  message: 'ok';
  data: unknown;
};

export type ApiErrEnvelope = {
  code: -1;
  message: string;
  data: unknown;
};

export function jsonOk(data?: unknown, init?: ResponseInit): Response {
  const body: ApiOkEnvelope = {
    code: 0,
    message: 'ok',
    data: data ?? null,
  };

  return Response.json(body, { ...init, status: init?.status ?? 200 });
}

export function jsonErr(
  status: number,
  message: string,
  data?: unknown,
  init?: ResponseInit
): Response {
  const body: ApiErrEnvelope = { code: -1, message, data: data ?? null };

  return Response.json(body, { ...init, status });
}
