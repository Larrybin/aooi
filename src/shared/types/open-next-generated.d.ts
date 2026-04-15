declare module '../../.open-next/cloudflare/images.js' {
  export function handleCdnCgiImageRequest(
    url: URL,
    env: unknown
  ): Promise<Response> | Response;

  export function handleImageRequest(
    url: URL,
    headers: Headers,
    env: unknown
  ): Promise<Response> | Response;
}

declare module '../../.open-next/cloudflare/init.js' {
  export function runWithCloudflareRequestContext<T>(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    callback: () => Promise<T> | T
  ): Promise<T>;
}

declare module '../../.open-next/middleware/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext
  ): Promise<Request | Response>;
}
