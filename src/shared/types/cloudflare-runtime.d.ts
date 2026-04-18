/**
 * Cloudflare Workers 运行时的最小全局类型兜底。
 *
 * `wrangler types` 生成的 `src/shared/types/cloudflare.d.ts` 当前被 `.gitignore`
 * 忽略，而仓库仍需要一份稳定存在的最小类型来支撑 worker 入口 typecheck。
 * 这里仅保留 Cloudflare-only 路径需要的 `ExecutionContext` 兜底，避免构建依赖
 * 本地生成产物。
 */
interface ExecutionContext<Props = unknown> {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  readonly props: Props;
}
