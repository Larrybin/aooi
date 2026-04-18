/**
 * OpenNext generated module declarations.
 *
 * TypeScript 无法直接用相对路径 `declare module '../../…'` 解析这些 worker import，
 * 构建前会由 `scripts/sync-open-next-generated-types.mjs` 把这里的声明物化成
 * `.open-next` 目录下的镜像 `.d.ts` / `.d.mts` 文件，让 build typecheck
 * 与 Cloudflare worker 入口共享同一份类型源。
 */
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

declare module '../../.open-next/server-functions/default/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}

declare module '../../.open-next/server-functions/auth/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}

declare module '../../.open-next/server-functions/payment/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}

declare module '../../.open-next/server-functions/member/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}

declare module '../../.open-next/server-functions/chat/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}

declare module '../../.open-next/server-functions/admin/handler.mjs' {
  export function handler(
    request: Request,
    env: unknown,
    ctx: ExecutionContext,
    signal?: AbortSignal
  ): Promise<Response> | Response;
}
