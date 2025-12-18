# 代码健壮性审计报告（仅 `src/`）

> 范围：仅覆盖 `src/**`  
> 交付：审计报告 + 整改清单（不改代码）  
> 基线：当前 `pnpm lint` / `pnpm build` 均通过，说明类型/构建层面基本健康；本报告聚焦“运行时健壮性/容错/可恢复性/可观测性/类型逃逸控制”。

## 结论概览

### 风险摘要（按优先级）
- **P0（建议优先修复）**：存在少量“脏数据/异常输入即可导致线上 500 或事务失败”的点，核心集中在 **未保护的 `JSON.parse`** 与 **事务内解析**。
- **P1（建议短期修复）**：全局/根级错误兜底不足（缺少 `src/app/error.tsx` / `src/app/global-error.tsx`），以及 API 内存驻留结构可能无界增长。
- **P2（建议持续治理）**：类型逃逸（`@ts-ignore`/`as any`/`as unknown as`）、`catch (any)`、前端大量 `console.*`，会降低可维护性与故障定位效率。

### 风险等级定义
- **P0**：可导致线上崩溃/500、事务失败、核心链路不可用或数据一致性风险
- **P1**：扩大故障影响面/恢复困难/可观测性不足/潜在内存问题
- **P2**：维护成本与长期可靠性风险（类型逃逸、弱约束、日志噪音等）

## 风险矩阵（摘要）

| 类别 | 典型问题 | 触发概率 | 影响面 | 优先级 |
|---|---|---:|---:|---|
| 数据解析 | 未保护 `JSON.parse` | 中 | 中-高 | P0 |
| 事务健壮性 | 事务内解析/回滚逻辑可被脏数据打断 | 低-中 | 高 | P0 |
| 错误兜底 | 缺少根级错误边界 | 中 | 中 | P1 |
| 资源与内存 | 无界 `Map`（按任务累积） | 中（长生命周期实例） | 中 | P1 |
| 类型与异常处理 | `catch (any)` / `@ts-ignore` / `as any` | 中 | 低-中 | P2 |
| 可观测性 | 客户端 `console.*` 与错误响应缺少 `requestId` | 中 | 低-中 | P2 |

## 整改清单（按优先级）

### P0：立即修复

#### P0-1：事务内 `JSON.parse` 未保护导致回滚流程失败
- 位置：`src/shared/models/ai_task.ts:68`
- 状态：已修复（使用 `src/shared/lib/json.ts` 的 `safeJsonParse` + 结构守卫，解析失败降级为空数组并记录日志）
- 现象：`consumedCredit.consumedDetail` 若为非 JSON/非数组，将直接抛异常，中断“失败任务返还积分”逻辑。
- 影响：AI 任务失败时积分回滚不稳定；可能导致用户积分永久扣除或事务失败。
- 建议整改：
  - 使用统一的 `safeJsonParse`（返回 `unknown`）并做结构校验（必须为数组；元素需包含 `creditId` 与 `creditsConsumed:number`）。
  - 在解析失败时：记录告警日志 + 走“保守路径”（不返还/或按可确认字段返还），但 **必须** 保证事务流程可继续。
- 验证点：
  - 构造 `consumedDetail = '' / 'not-json' / '{}' / '[]' / '[{\"creditId\":\"x\",\"creditsConsumed\":1}]'`，确保不会抛异常，且返还逻辑按预期执行。

#### P0-2：页面渲染路径上直接 `JSON.parse` 导致 500
- 位置：`src/app/[locale]/(landing)/activity/ai-tasks/page.tsx:57`
- 状态：已修复（使用 `safeJsonParse`，解析失败时降级展示 `'-'`）
- 现象：`item.taskInfo` 只要包含非 JSON 字符串，就会导致页面渲染异常。
- 影响：AI 任务列表页对历史/脏数据不兼容，线上可能出现局部页面 500。
- 建议整改：
  - 使用共享的安全解析（返回 `null`/空对象）+ 结构校验（`songs/images/errorMessage`）。
  - 对解析失败进行降级展示（例如显示 `'-'` 或 “数据格式异常”），避免影响整页渲染。
- 验证点：
  - DB 中 `taskInfo` 为非法 JSON、空字符串、旧结构等场景下页面仍可正常渲染并降级展示。

#### P0-3：API 路由中未保护的 `JSON.parse` 可导致请求失败
- 位置：`src/app/api/chat/route.ts:97`
- 状态：已修复（历史消息 `parts` 使用 `safeJsonParse`，解析失败降级为空数组）
- 现象：从 DB 取历史消息 `message.parts` 后直接 `JSON.parse`；一旦脏数据/历史数据格式不一致，会使 `/api/chat` 请求失败。
- 影响：聊天流式响应可能被单条历史消息破坏，导致用户无法继续对话。
- 建议整改：
  - 与 `src/app/api/chat/messages/route.ts`、`src/app/api/chat/info/route.ts` 保持一致：引入/复用 `safeJsonParse` 并降级为空数组。
  - 对 `validatedMessages` 在送入模型前做结构验证（项目已引入 `validateUIMessages`，可用于强校验并返回 `BadRequestError`）。
- 验证点：
  - DB 中插入一条 `parts='not-json'` 的历史消息，接口仍可响应（该条消息被忽略/降级为空）。

### P1：短期修复

#### P1-1：缺少根级错误边界导致全局不可恢复错误体验
- 位置：缺失 `src/app/error.tsx`、缺失 `src/app/global-error.tsx`（当前仅有 `src/app/not-found.tsx`，以及局部 `src/app/[locale]/(admin)/admin/settings/error.tsx`）
- 现象：发生未捕获渲染错误时，缺少统一兜底 UI 与“重试”入口。
- 影响：线上故障时用户体验差、恢复能力弱；错误定位依赖日志而缺少用户侧重试路径。
- 建议整改：
  - 增加根级 `error.tsx`（段级错误边界）与 `global-error.tsx`（根布局级兜底），提供最小可用的重试/返回首页/反馈入口。
  - 结合 Next.js App Router 约定实现（error 组件需为 Client Component）。
- 验证点：
  - 人为抛错（仅开发环境）能进入错误边界 UI，`reset()` 可重试。

#### P1-2：按任务累积的无界 `Map` 可能导致长生命周期实例内存增长
- 位置：`src/app/api/ai/query/route.ts:20`
- 现象：`lastProviderQueryAtByTaskId` 无 TTL/上限清理。
- 影响：在长生命周期 Node 实例（非纯 serverless）下，持续请求会导致内存缓慢增长。
- 建议整改：
  - 改为带 TTL 的缓存（例如：只保留最近 N 条，或每次写入时清理过期 key）。
  - 或将节流信息下沉到更合适的层（如按用户/任务在持久层记录 lastQueryAt）。
- 验证点：
  - 压测/长跑下 Map size 可控，不随历史任务无限增长。

### P2：持续治理

#### P2-1：`safeJsonParse` 在多处重复实现，导致行为不一致
- 位置：
  - `src/app/api/ai/query/route.ts:30`
  - `src/app/api/chat/info/route.ts:9`
  - `src/app/api/chat/messages/route.ts:13`
  - `src/app/[locale]/(chat)/chat/[id]/page.tsx:10`
- 现象：同名函数重复，后续修改/策略调整易产生偏差。
- 建议整改：提取到 `src/shared/lib/json.ts`（或类似位置）并统一策略（返回类型、默认值、结构校验辅助）。

#### P2-2：类型逃逸点（`@ts-ignore` / `as any` / `as unknown as`）降低可维护性
- 位置（代表性）：
  - `src/shared/blocks/common/markdown-editor.tsx:4`（`@ts-ignore`）
  - `src/shared/blocks/common/locale-detector.tsx:20`（`navigator as any`）
  - `src/extensions/payment/paypal.ts:376-381`（`event as any`）
  - `src/core/docs/source.ts:24`（`as unknown as { files: any }`）
  - `src/shared/contexts/app.tsx:117`（`as unknown as OneTapCapable`）
- 建议整改：
  - 为第三方库补类型声明（`d.ts`）或局部定义最小接口（KISS）。
  - 用类型守卫替代 `any`（例如 `isPayPalEvent()` / `hasUserLanguage()`）。

#### P2-3：`catch (any)` 与客户端 `console.*` 影响可观测性与噪音控制
- 位置（代表性）：
  - `src/app/api/payment/callback/route.ts:69`（`catch (e: any)`）
  - `src/shared/contexts/app.tsx:69/92/111/123`（多处 `console.log`）
  - `src/shared/blocks/chat/library.tsx:74`、`src/shared/blocks/form/checkbox.tsx:26` 等
- 建议整改：
  - `catch` 参数优先用 `unknown`，统一转为 `Error`（保留 message/stack 的规则化策略）。
  - 客户端日志改为受控开关（例如 `NEXT_PUBLIC_DEBUG`）或统一上报（如 Sentry/自研 endpoint），避免生产噪音与泄露风险。

## 备注：外部调用健壮性（建议）
- 多处 `fetch()` 未设置超时/取消/重试策略（例如存储 provider 的 `downloadAndUpload()`），在不可信 URL 或慢链路下会放大资源占用。
- 建议以“按场景最小化”推进：
  - **服务端下载**：限制最大响应大小（Content-Length 或流式计数）、超时、必要时白名单域名。
  - **客户端轮询**：已有 3 分钟超时思路（`src/shared/blocks/generator/music.tsx`），建议抽成通用策略，避免重复与遗漏。

## 最小回归建议（用于落地整改时）
- 静态检查：`pnpm lint`、`pnpm build`
- 关键路径手测：
  - 聊天：历史消息包含异常 `parts` 时仍可进入会话并继续发送
  - AI 任务：任务失败触发“返还积分”逻辑时不因解析异常中断
  - AI 任务列表页：`taskInfo` 异常/旧结构时页面降级展示，不导致整页崩溃
  - 支付：配置字段（如 `creem_product_ids`）为空/非 JSON 时走保守降级路径并有可定位日志
