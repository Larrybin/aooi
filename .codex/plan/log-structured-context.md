# 任务：server 关键链路日志结构化字段统一

## 目标

- 将本次已迁移到 `logger` 的 server 关键链路日志补齐结构化字段：
  - `route`：请求路径（pathname）
  - `requestId`：从请求头读取（优先）或生成
  - `provider` / `userId`：业务上下文（可用时）
- 不改变对外 API 与业务行为，仅改变日志内容与可检索性。

## 实施范围（本轮）

- `src/shared/lib/api/route.ts`：`withApi()` 捕获未处理异常时自动注入 `route/requestId/method`。
- Route Handlers：
  - `src/app/api/payment/notify/[provider]/route.ts`
  - `src/app/api/payment/callback/route.ts`
  - `src/app/api/payment/checkout/route.ts`
  - `src/app/api/email/send-email/route.ts`
  - `src/app/api/storage/upload-image/route.ts`
  - `src/app/ads.txt/route.ts`
- Providers（减少潜在 PII 输出）：
  - `src/extensions/email/resend.ts`
  - `src/extensions/payment/paypal.ts`

## 方案要点

1. 新增 `src/shared/lib/request-context.server.ts`（`server-only`）：
   - `getRequestContext(req)` 返回 `{ route, requestId, method }`。
2. 各入口在日志 meta 里统一追加上述字段，业务字段使用固定 key：
   - `provider`、`userId`（有值时才传入）。
3. 回归：
   - `pnpm lint`
   - `npx tsc --noEmit`
   - `pnpm build`（可能受 Google Fonts 网络抖动影响，必要时重试）

