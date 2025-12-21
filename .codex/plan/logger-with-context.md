# 任务：为 server logger 增加 `with(ctx)` 以减少重复 meta spread

## 目标

- 提供 `logger.with(ctx)`：生成绑定上下文的子 logger，调用时自动把 `ctx` 合并进 meta。
- 不改变行为：
  - 生产仅输出 `error`；
  - `debug` 仅在 `NEXT_PUBLIC_DEBUG=true`；
  - 脱敏规则与输出格式保持一致。

## 变更点

1. `src/shared/lib/logger.server.ts`
   - 新增 `logger.with(ctx)`。
   - 定义浅合并策略：
     - `ctx` 与 `meta` 均为 plain object 时：`{ ...ctx, ...meta }`（调用点优先覆盖）。
     - 否则：包装为 `{ ctx, meta }`。
2. 小范围迁移：在已统一 `requestId/route` 的关键链路上，将 `logger.*({...ctx,...})` 改为：
   - `const log = logger.with(ctx); log.error(..., { ... })`

## 回归

- `pnpm lint`
- `npx tsc --noEmit`
- `pnpm build`（可能受 Google Fonts 网络抖动影响，必要时重试）

