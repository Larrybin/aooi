/**
 * Cloudflare Workers 运行时的最小全局类型兜底。
 *
 * 仓库会提交 `wrangler types` 生成的 `src/shared/types/cloudflare.d.ts` 作为
 * 完整 Cloudflare 契约，但源码层仍保留这份最小全局类型兜底，避免在类型生成
 * 尚未执行前阻塞基础 typecheck。
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
  put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<unknown>;
}
