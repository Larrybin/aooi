# 任务：日志脱敏/收敛（方案 2 改良版：仅对 server 侧强约束）

## 背景与约束

- 目标：统一 server 侧日志出口、按 key 名命中脱敏、减少生产噪音。
- 策略：
  - 生产环境默认仅输出 `error`。
  - `debug` 仅在 `NEXT_PUBLIC_DEBUG=true` 时启用（可在生产开启）。
  - 允许新增内部 logger 工具模块；不新增三方依赖；不新增 env。
  - 仅对明确 server 侧目录做强约束（避免影响 client 调试）。
- 不做：全仓替换所有 `console.*`；不触碰测试锚点（本轮搁置）。

## 执行计划

1. 新增 `src/shared/lib/logger.server.ts`（`server-only`）：
   - `logger.{debug,info,warn,error}()`：按环境策略决定是否输出。
   - `redact()`：按 key 名匹配递归脱敏（限制深度/数组长度，处理循环引用）。
2. 迁移高风险/关键 server 日志到 `logger`：
   - `src/app/api/**`、`src/extensions/**`、`src/shared/models/**`、`src/shared/services/**`、`src/core/**`、`src/shared/lib/api/**`。
   - 优先处理：支付、邮件、API 包装器、DB/theme 加载等。
3. ESLint 防回归（仅 server 侧目录）：
   - 对上述目录启用 `no-console: error`（强制走 logger）。
   - 对 `src/shared/lib/logger.server.ts` 例外放行 `console`（logger 内部实现需要）。
4. 回归：
   - `pnpm lint`
   - `npx tsc --noEmit`
   - `pnpm build`

