---
title: API 护栏与 Zod 入参校验（Route Handlers）
created_at: 2025-12-16
scope: src/app/api/**
constraints:
  - 错误响应 JSON 结构保持 {code,message,data}，仅调整 HTTP status
  - schema 单一来源：src/shared/schemas/api/**
  - 本次不改 chat 页面 use client
---

## 背景与目标

- 现状：`src/app/api/**` 多数路由手写 `req.json()` + `if` 校验，错误多为 200 + `{code:-1}`，鉴权/权限/幂等缺少统一入口护栏。
- 目标：统一引入 Zod 入参校验与可复用护栏，并返回正确 HTTP status（400/401/403/404/500），同时保持 `{code,message,data}` JSON 结构以降低前端联动。

## 方案摘要（已确认：方案 1）

1. 新增 API 基础设施（错误类型 / 解析 / guard / wrapper）：
   - `src/shared/lib/api/errors.ts`
   - `src/shared/lib/api/parse.ts`
   - `src/shared/lib/api/guard.ts`
   - `src/shared/lib/api/response.ts`
   - `src/shared/lib/api/route.ts`

2. 新增 schema 单一来源：
   - `src/shared/schemas/api/**`（按路由分组，导出 schema + z.infer 类型）

3. 逐路由改造：
   - 覆盖 `src/app/api/**` 项目自有 Route Handlers（AI/Chat/Payment/Storage/User/Config/Email）
   - 跳过第三方接管或生成的路由：`auth/[...all]`、`docs/search`、以及需要 redirect 的 `payment/callback`

4. Webhook（支付 notify）：
   - provider 内部签名校验仍由 `paymentProvider.getPaymentEvent({req})` 负责（使用 `req.text()`）
   - notify 路由增加 params 校验与幂等“早返回”护栏（订单终态直接 200）
   - 引入可判定错误类型（verification/payload/config），映射到 401/400/500

5. 校验命令：
   - `pnpm lint`
   - `pnpm build:fast`
