---
title: fix-csrf-origin-guard
status: implemented
owner: codex
---

# 目标

为“带 Cookie 的写请求 + 需要登录”的自定义 API Route 增加 CSRF 防护：校验 `Origin/Referer` 与 `Host/X-Forwarded-Host` 同源，否则拒绝（403）。

# 背景与约束

- 技术栈：Next.js App Router + better-auth（`src/app/api/auth/[...all]/route.ts`）。
- 现状：better-auth 自身端点已通过 `trustedOrigins` 做 Origin 校验；自定义写接口（`src/app/api/**/route.ts`）缺少同等 CSRF 保护。
- 范围：只覆盖“带 Cookie 的写请求 + 需要登录”的接口（即通过 `requireUser(req)` 鉴权的写接口）。
- 不支持：非浏览器客户端（curl/脚本）携带 Cookie 调用写接口（因此可严格要求存在 `Origin/Referer`）。

# 方案（已选）

方案 1：服务端校验 `Origin/Referer` 与 `Host/X-Forwarded-Host` 一致性（与 Next.js Server Actions 的默认 CSRF 防护思路一致）。

# 执行计划（不含实现代码）

1. 新增 CSRF 校验 helper（server-only）
   - 文件：`src/shared/lib/api/csrf.server.ts`
   - 逻辑要点：
     - 仅当 `method` ∈ `{POST,PUT,PATCH,DELETE}` 且存在 `cookie` header 时启用校验。
     - 从 `Origin`（优先）或 `Referer`（fallback）解析出 `originHost`。
     - 从 `x-forwarded-host`（优先）或 `host`（fallback）或 `new URL(req.url).host` 得到 `expectedHost`。
     - 若 `originHost` 缺失/为 `null` 或与 `expectedHost` 不一致：抛出 `ForbiddenError`（403）。

2. 将 CSRF 校验挂到鉴权入口
   - 文件：`src/shared/lib/api/guard.ts`
   - 改动：
     - `requireUser()` 改为 `requireUser(req: Request)`。
     - 在读取 session 前执行 `assertCsrf(req)`（仅对 cookie+写方法生效）。
     - 更新 usage 注释，明确新约定。

3. 更新所有需要登录的写接口调用点
   - 文件（预期）：
     - `src/app/api/user/get-user-info/route.ts`
     - `src/app/api/user/get-user-credits/route.ts`
     - `src/app/api/ai/query/route.ts`
     - `src/app/api/ai/generate/route.ts`
     - `src/app/api/storage/upload-image/route.ts`
     - `src/app/api/chat/*/route.ts`
     - `src/app/api/payment/checkout/route.ts`
     - `src/app/api/email/send-email/route.ts`
   - 改动：统一改为 `await requireUser(req)`，必要时让 handler 显式接收 `req: Request`（避免未使用参数）。

4. 文档同步（最小）
   - 文件：`docs/CODE_REVIEW.md`
   - 增补：在安全章节明确“需要登录的写接口必须调用 `requireUser(req)`，该 guard 内置 CSRF（Origin/Host）校验”。

5. 最小化验证
   - 命令（建议）：
     - `pnpm exec prettier --check <变更文件列表>`
     - `pnpm exec eslint <变更文件列表>`
   - 预期结果：
     - 同源浏览器请求不受影响；
     - 跨站携带 Cookie 的写请求返回 403，响应仍符合 `{code,message,data}`，并携带 `x-request-id`。

# 非目标（本次不做）

- 处理其它“GET + 有副作用”的页面路由（例如 `settings/*/retrieve`）；仅在本任务结束后单独拆卡处理。
