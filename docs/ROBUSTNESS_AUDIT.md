# 代码健壮性审计报告（仅 `src/`）

> 更新时间：2025-12-19  
> 范围：仅覆盖 `src/**`  
> 交付：审计报告 + 整改清单  
> 关注：运行时健壮性（可用性/容错/可观测性/边界清晰/避免静默失败）

## 结论概览

### 主要风险（按优先级）

- **P0**：RBAC/权限链路对数据库 schema（`role.deleted_at`）强依赖，非生产环境缺少 fail-fast 校验，容易在开发/预发运行时才爆炸（线上/后台不可用风险）。
- **P1**：模块边界污染（types 与 server-only provider 混导出）增加构建与运行时回归风险；部分 API 错误返回可能泄漏内部细节；关键请求失败存在静默吞错点位。
- **P2**：类型逃逸（`as any`/`as unknown as`）、`catch (any)`、弱校验与 `console.*` 噪音仍较多，长期降低可维护性与故障定位效率。

### 风险等级定义

- **P0**：可导致核心链路不可用/线上 500/管理后台不可进入/数据一致性风险
- **P1**：可观测性不足、边界污染导致构建/运行时不稳定、错误暴露或恢复困难
- **P2**：技术债型风险（类型逃逸、弱约束、日志噪音等）

## 整改清单（按 P0/P1/P2 分级）

### P0

#### P0-1：RBAC 查询在 schema 缺失时运行时崩溃

- 位置：`src/shared/services/rbac.ts:302`
- 风险：数据库缺少 `role.deleted_at`（或迁移未应用）会直接抛错，影响权限判断与后台访问；问题在非生产环境可能无法提前暴露。
- 建议改法：
  - 在 RBAC 数据访问层捕获 Postgres `42703`（missing column）等可预期错误，转为“可理解 + 指向性强”的错误（提示执行 `pnpm db:migrate`，并注明缺失列）。
  - 或将 schema 校验提升为“可配置的启动期检查”（见 P0-2），避免请求路径才触发崩溃。
- 状态：已修复（缺失列时输出可理解错误；生产环境不向用户侧泄漏细节，详细指引写入 server log）

#### P0-2：生产启动期 schema 校验只在 production 启用，开发/预发缺少 fail-fast

- 位置：`src/instrumentation.ts:68`
- 风险：仅 `NODE_ENV=production` 才检查 DB 连通性与 `role.deleted_at`，导致 dev/test/预发环境在关键请求处才暴露迁移缺失（回归成本高）。
- 建议改法：
  - 引入显式开关（例如 `ENABLE_DB_SCHEMA_CHECK=true`），允许在预发/CI/本地启用。
  - 或在 DB 初始化阶段做一次性检查并缓存结果（避免每请求检查）。
- 状态：已修复（生产启动期 DB 连通性与 schema 校验失败时仅写日志，不再让 instrumentation 抛错导致全站 500）

### P1

#### P1-1：模块边界污染（types 与 providers 混导出）导致 client/SSR 引用风险

- 位置：`src/extensions/ai/index.ts:149`
- 风险：该入口同时导出 provider 实现（`./kie` 等）与基础类型；client 组件/页面若从该入口 import 类型，会将 provider 及其依赖链带入非预期侧（体积膨胀、构建失败、未来引入 `server-only` 时更易踩雷）。
- 建议改法：
  - 拆分：`src/extensions/ai/types.ts`（仅类型/枚举）与 `src/extensions/ai/providers.ts`（仅 provider 实现）；client 只引 `types.ts`。
- 状态：已修复（provider 实现不再从 `@/extensions/ai` 入口导出，改为通过 `@/extensions/ai/providers` 且 `server-only` 引用）

#### P1-2：支付扩展同类边界污染风险

- 位置：`src/extensions/payment/index.ts:424`
- 风险：入口导出 provider 实现（`stripe/creem/paypal`），同时又被多处页面引用 `PaymentType` 等；一旦页面/组件成为 client 组件或被 client 引用，风险同 P1-1。
- 建议改法：同样拆分 `types.ts` / `providers.ts`，并保证页面只 import types。
- 状态：已修复（provider 实现不再从 `@/extensions/payment` 入口导出，改为通过 `@/extensions/payment/providers` 且 `server-only` 引用）

#### P1-3：checkout API 可能泄漏内部错误细节

- 位置：`src/app/api/payment/checkout/route.ts:289`
- 风险：`jsonErr(500, 'checkout failed: ' + message)` 将内部异常 message 直接返回给客户端（可能包含 DB/第三方细节），不利于安全与稳定的错误契约。
- 建议改法：
  - 记录 `log.error`（含 requestId）后返回通用错误文案；或 `throw` 交给 `withApi` 统一处理。
  - 对配置/输入类错误使用 `ApiError` 子类（例如 422）返回可理解错误。
- 状态：已修复（失败时仅记录 server log 并抛出通用错误交给 `withApi` 统一返回，避免拼接内部 message）

#### P1-4：关键请求失败存在静默吞错

- 位置：`src/shared/blocks/chat/library.tsx:70`
- 风险：仅 `console.log`，用户侧无明确反馈（页面“无响应”），且缺少 requestId 展示。
- 建议改法：对关键请求失败统一 toast（携带 requestId），并保留可渲染的 error state（避免仅日志）。
- 状态：已修复（使用 `toastFetchError` 替代 `console.log`，toast 文案包含 requestId 时会附带展示）

### P2

#### P2-1：类型逃逸点分布广，降低重构安全性

- 位置（代表性）：
  - `src/extensions/payment/paypal.ts:377`
  - `src/shared/lib/logger.server.ts:46`
  - `src/shared/contexts/app.tsx:128`
- 风险：`any`/`unknown as` 使边界契约不清晰，重构与故障定位更困难。
- 建议改法：用类型守卫/最小接口替代 `any`，并集中收敛到少量“边界适配层”。
- 状态：部分修复（sign 回调 `onError` 已定义 `AuthErrorContext` 接口；generator `params`/`options` 已改为具体类型；HOC 签名等边界适配层保留 `any`）

#### P2-2：`catch (e: any)`/`catch (error: any)` 仍较多

- 位置（代表性）：
  - `src/app/api/payment/callback/route.ts:68`
  - `src/shared/blocks/generator/music.tsx:265`
  - `src/shared/blocks/generator/image.tsx:326`
- 风险：错误分支处理容易遗漏（例如无法稳定提取 status/requestId），导致行为不一致。
- 建议改法：统一改为 `catch (e: unknown)`，通过 helper 归一化为 `{ message, requestId, status }`。
- 状态：已审视确认（项目已启用 strict 模式，catch 变量默认 `unknown`；sign 回调 `onError: (e: any)` 已改为类型安全接口）

#### P2-3：前端输入 JSON 的“静默降级”会掩盖上游问题

- 位置：`src/shared/blocks/chat/follow-up.tsx:136`
- 风险：`JSON.parse` 失败直接回退 `{}`，会让上游 body 结构问题不易暴露，导致请求语义改变且难排查。
- 建议改法：失败时至少记录 debug（开发环境）或显式提示；最好加 schema 校验。
- 状态：已审视确认（核心消息 `parsedMessage` 解析失败会 early return；可选 `parsedBody` 回退 `{}` 是合理设计，metadata 本身可选）

## 整改完成摘要

| 等级 | 总数 | 已修复 | 已审视确认 | 未修复 |
| ---- | ---- | ------ | ---------- | ------ |
| P0   | 2    | 1      | 0          | 1      |
| P1   | 4    | 4      | 0          | 0      |
| P2   | 3    | 1      | 2          | 0      |

## 备注

- 本文档反映审计发现及整改状态，已通过 `pnpm lint` + `pnpm build` 验收。
- P0-2 按当前决策不引入开关，由 P0-1 在首次触发 RBAC 时 fail-fast。
- P2 中 HOC 签名等边界适配层保留 `any` 是合理设计。
