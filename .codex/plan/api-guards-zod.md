# 上下文

目标：本次仅改造 `src/app/api/**`，统一入参校验与入口护栏（鉴权/权限/幂等），并使用正确 HTTP status（400/401/403/404/500）。  
约束：错误响应 JSON 结构保持 `{code,message,data}`（仅 status 改），降低前端联动成本；schema 单一来源统一放在 `src/shared/schemas/api/**`。  
决定：
- Route Handler 统一使用 `withApi()` 捕获错误并返回 `{code,message,data}`。
- Zod v4：`z.record()` 必须传 `(keySchema, valueSchema)`；`AIGenerate` 入参强制 `prompt` 必填以满足 `AIGenerateParams` 与 DB 非空约束。
- Webhook：provider 内部用 raw body 校验签名/载荷并抛可判定错误类型，路由层映射到 400/401；对订单终态早返回实现幂等（不引入新事件表，YAGNI）。

完成情况（当前工作区）：
- API 基础设施：`src/shared/lib/api/*`（errors/parse/guard/route/response）
- Schemas：`src/shared/schemas/api/**`
- Routes：`src/app/api/**` 多个路由已接入校验/护栏（详见 `git diff --name-only`）
- 验证：`pnpm lint` ✅；`pnpm build:fast` ✅

风险提示：
- 当前仓库存在大量与“仅 API 护栏与校验”无关的改动/未跟踪文件；如需收敛变更集，需要执行批量回滚/清理（高风险操作）。

# 计划摘要（已进入执行）

1. 写入本计划文件（上下文+计划摘要）。
2. 修复阻塞构建的类型问题（AI generate 入参类型/Schema 与 Zod v4 `record` 兼容）。
3. 统一 500 错误输出，避免泄露内部异常信息（仅记录到 server log）。
4. 跑 `pnpm lint`、`pnpm build:fast` 回归验证。
5. （待用户明确确认）收敛无关改动：仅保留本次 API 护栏与校验相关变更。

