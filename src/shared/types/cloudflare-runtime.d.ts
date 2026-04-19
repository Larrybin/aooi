/**
 * Cloudflare Workers 运行时的最小全局类型兜底。
 *
 * `wrangler types` 生成的 `src/shared/types/cloudflare.d.ts` 当前被 `.gitignore`
 * 忽略，而仓库仍需要一份稳定存在的最小类型来支撑构建期 typecheck。
 * 这里只保留源码真实依赖的最小全局类型，避免 CI 构建依赖本地生成产物。
 */
interface ExecutionContext<Props = unknown> {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  readonly props: Props;
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

type R2PutValue =
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | ReadableStream
  | string
  | null;

type R2HTTPMetadata = {
  contentType?: string;
  contentDisposition?: string;
};

type R2PutOptions = {
  httpMetadata?: R2HTTPMetadata;
};

interface R2Bucket {
  put(
    key: string,
    value: R2PutValue,
    options?: R2PutOptions
  ): Promise<unknown>;
}
