/**
 * Usage:
 * - Use `jsonOk` / `jsonErr` in Route Handlers (especially in wrappers).
 * - Response JSON structure matches legacy `{code,message,data}`; only HTTP status changes.
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
  const body: ApiErrEnvelope = { code: -1, message, data: data ?? [] };

  return Response.json(body, { ...init, status });
}
