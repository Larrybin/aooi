---
task: P1：将 src/shared/services/* 的 if(true) 改为显式策略（不新增 env / 不改变行为）
mode: 执行计划存档
scope:
  include:
    - src/shared/services/ads.ts
    - src/shared/services/affiliate.ts
    - src/shared/services/analytics.ts
    - src/shared/services/ai.ts
    - src/shared/services/email.ts
    - src/shared/services/storage.ts
    - src/shared/services/customer_service.tsx
    - src/shared/services/config_refresh_policy.ts
principles: [SOLID, KISS, DRY, YAGNI]
constraints:
  - 不新增 env
  - 对外导出 API 完全不变
  - 默认行为不变：每次调用都从最新 configs 重建 service（强一致配置）
motivation:
  - 现有 if(true) 伪条件误导读者（看似有缓存，实为总刷新），且重复出现 7 次
deliverable:
  - 集中式“显式刷新策略”模块 + 7 处 service getter 重构
validation:
  - npx tsc --noEmit
---

## 方案（显式策略，无 env）

- 引入 `CONFIG_REFRESH_POLICY = 'always'` 作为显式策略常量（无 env），表达“强一致：每次取最新配置重建”。
- 提供 `buildServiceFromLatestConfigs(buildWithConfigs)` 工具函数，统一实现 always-refresh。
- 可选提供 `createRequestScopedServiceGetter(buildWithConfigs)`：由调用方在单次 request 内创建并复用（默认不接入现有导出，避免改变行为）。

## 执行步骤

1) 新增 `src/shared/services/config_refresh_policy.ts`
2) 重构 7 个服务的 `get*Service()`：
   - 移除 `if (true)` 与无意义的 module-level `let xxxService`
   - 改为 `return buildServiceFromLatestConfigs(getXWithConfigs)`（每次重建，行为一致）
3) 运行 `npx tsc --noEmit`

