---
task: 拆分支付与迁移RBAC Guard
mode: 执行前计划存档
principles: [SOLID, KISS, DRY, YAGNI]
constraints:
  - payment.ts 对外导出 API 完全不变
  - 允许修复 renewal 授信 scene，并考虑审计/报表字段语义
  - 测试锚点本轮搁置
scope:
  - src/shared/services/payment.ts
  - src/shared/services/payment/*
  - src/shared/services/rbac_guard.ts
  - src/core/rbac/*
  - src/app/**（仅改 import 指向）
validation:
  - pnpm lint
  - npx tsc --noEmit
---

## 目标

1) 拆分 `src/shared/services/payment.ts`：provider wiring / 订单&订阅事务编排 / credit 授信构造逻辑分离，降低耦合、便于维护。  
2) 调整 RBAC：guard 逻辑迁移到 `src/shared/services`，`src/core/rbac` 仅保留兼容 re-export，避免 core 承担业务 guard。  
3) 修复 renewal 授信 scene：将 renewal 场景下 `credit.transactionScene` 统一为 `renewal`，确保报表/审计语义一致（依赖 `order.paymentType === renew`）。

## 设计

### Payment

- `src/shared/services/payment/manager.ts`：仅负责 provider wiring（Stripe/Creem/PayPal）与 `getPaymentService()` 获取实例（保持当前行为：每次按 configs 构建）。
- `src/shared/services/payment/credit.ts`：集中构造 `NewCredit`，统一 scene 映射（ONE_TIME->payment, SUBSCRIPTION->subscription, RENEW->renewal）与 expiresAt 计算。
- `src/shared/services/payment/flows.ts`：承载 `handleCheckoutSuccess/handlePaymentSuccess/handleSubscription*` 主流程，复用 credit builder 与现有 transaction helper。
- `src/shared/services/payment.ts`：facade，仅 re-export/委托上述实现，确保对外 API 不变。

### RBAC Guard

- 新增 `src/shared/services/rbac_guard.ts`：迁移 PERMISSIONS/requirePermission/requireAdminAccess/withPermission 等 guard。
- `src/core/rbac/permission.ts` 改为 re-export，`src/core/rbac/index.ts` 保持现有导出方式以兼容外部引用。
- 更新 `src/app/**` 里的引用从 `@/core/rbac*` 切到 `@/shared/services/rbac_guard`。

