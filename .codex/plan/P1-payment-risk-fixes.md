# P1 Payment Risk Fixes - 执行计划（方案 2）

## 背景 / 需求

本轮目标是对支付链路进行 P1 风险加固：

- P1-1：生产环境（`process.env.NODE_ENV === 'production'`）启用 Stripe 时，强制要求配置 `stripe_signing_secret`（fail-fast）。
- P1-3：为 `SUBSCRIBE_UPDATED` / `SUBSCRIBE_CANCELED` 增加幂等保护，并保证 **已 canceled 永不回退**（并发/乱序下仍成立）。
- P1-4：为 `flows.ts` 关键流程补齐 **带 requestId 的结构化日志**，字段边界：
  - `orderNo`
  - `provider`
  - `paymentStatus`
  - `transactionId`
  - `subscriptionId` / `subscriptionNo`
  - `amount` / `currency`

范围明确：本轮不做 PayPal webhook 解析/优化。

## 方案选择

采用方案 2（推荐）：

- 路由层幂等短路 + DB 层原子保护（`status != canceled` 的条件更新）确保“canceled 不回滚”。
- 通过 `log` 注入让 `requestId` 贯穿到 `flows.ts` 内部日志。

## 执行步骤（原子化）

1) Stripe signingSecret 生产环境 fail-fast
- 文件：`src/shared/services/payment/manager.ts`
- 逻辑：
  - `isProduction && configs.stripe_enabled === 'true'` 时校验 `configs.stripe_signing_secret` 非空，否则抛错。

2) 订阅更新“不可回滚”DB 层保护
- 文件：`src/shared/models/subscription.ts`
- 新增：`updateSubscriptionBySubscriptionNoIfNotCanceled(subscriptionNo, updateSubscription)`
  - `WHERE subscriptionNo = ? AND status != 'canceled'`
  - 0 rows 则返回 `undefined`

3) notify 路由对 SUBSCRIBE_UPDATED/CANCELED 增加幂等短路
- 文件：`src/app/api/payment/notify/[provider]/route.ts`
- 逻辑：若 `existingSubscription.status === CANCELED`，直接 `jsonOk({message:'already processed'})`。

4) flows.ts 关键流程结构化日志（通过 log 注入）
- 文件：`src/shared/services/payment/flows.ts`
- 改动：
  - 为 `handleCheckoutSuccess/handlePaymentSuccess/handleSubscriptionRenewal/handleSubscriptionUpdated/handleSubscriptionCanceled` 增加可选 `log` 入参。
  - 在入口、幂等短路、成功写入/更新完成处记录日志（不输出 paymentResult 原文）。
  - `handleSubscriptionUpdated` 调用 DB 条件更新函数；若返回 `undefined`，记录被 canceled 阻止的日志并短路。

5) Route 注入 log
- 文件：
  - `src/app/api/payment/callback/route.ts`
  - `src/app/api/payment/notify/[provider]/route.ts`
- 逻辑：使用 `getRequestLogger(req).log` 传入 flows。

6) 验证
- `pnpm lint`
- `pnpm build`

## 成功标准

- 生产环境 Stripe 启用但未配置 `stripe_signing_secret` 时，服务在 provider 构建阶段报错（fail-fast）。
- `SUBSCRIBE_UPDATED` 在订阅已 `canceled` 时不会产生状态回滚；重复事件可快速短路。
- `flows.ts` 日志可通过 `requestId` 串联，且不包含 PII/敏感信息。
- lint/build 通过。
