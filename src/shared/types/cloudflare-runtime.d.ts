/**
 * Cloudflare Workers 运行时的最小全局类型兜底。
 *
 * `wrangler types` 生成的 `src/shared/types/cloudflare.d.ts` 当前被 `.gitignore`
 * 忽略，Vercel 构建拿不到这份文件时，会在 worker 入口的 typecheck 阶段丢失
 * `ExecutionContext`。这里保留一份仓库内稳定存在的最小声明，避免构建依赖本地
 * 生成产物。
 */
interface ExecutionContext<Props = unknown> {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  readonly props: Props;
}
