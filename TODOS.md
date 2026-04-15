# TODOS

## Review

### Payment webhook 回放与未知事件审计补偿工具

**What:** 增加支付 webhook 回放工具（按 provider、event id、时间窗重放），并提供未知事件审计记录的补偿处理入口。

**Why:** 当前生产策略是“未知事件忽略并审计”，但缺少回放与补偿工具会导致对账异常修复依赖人工脚本，恢复效率低。

**Context:** 本轮重构已统一 provider 契约与 `UNKNOWN` 事件语义。下一步应补齐 replay CLI/API、幂等保护、最小审计字段（provider/eventType/eventId/rawDigest/receivedAt）和操作留痕，保证账务核对链路可追溯。

**Effort:** M
**Priority:** P1
**Depends on:** 支付契约收敛与 notify 状态机稳定

### Cloudflare Admin Settings Phase 2 写路径验证

**What:** 为 Cloudflare `admin/settings/**` 增加第二阶段验证，覆盖关键写操作、配置保存、以及 provider 级提交成功/失败路径。

**Why:** 第一阶段只读 smoke 只能证明页面族可信，不能证明真实配置提交在 Cloudflare Worker 上可用。没有这条后续验证，团队很容易把“页面能打开”误当成“配置链路已被验证”。

**Context:** 当前已批准的一阶段方案是：7 个代表 tab、全 locale、结构契约优先、PR gate、混合 runner。它明确不做真实写入和第三方 provider 成功链路。建议未来第二阶段至少覆盖：保存成功、保存失败、配置回读一致、关键 provider 的 happy path/denied path，以及执行后状态清理。起点可直接复用本次新增的 `cf-admin-settings-smoke`、现有 RBAC/bootstrap、以及现有 `test:r2-upload-spike` / OAuth spike 的 runner 模式。

**Effort:** M
**Priority:** P1
**Depends on:** Cloudflare admin settings 第一阶段 smoke 落地并稳定进入 CI

### Ads provider/zone 扩展指南

**What:** 为 ads provider/zone 系统补一份短的扩展指南，说明新增 provider 或 zone 时需要同步修改哪些位置。

**Why:** 这次重构会把 ads 真相源收敛到 runtime resolver、zone registry、settings、module metadata 和 tests。没有一份扩展说明，下一次新增 provider/zone 时很容易重新把字符串和边界打散。

**Context:** 指南至少要覆盖 5 个点：从哪里新增 zone、从哪里新增 provider、如何更新 settings 定义、如何同步 product module metadata / docs、以及必须补哪些 tests 和 `ads.txt` 路径。目标不是写成长文档，而是让三个月后接手的人 10 分钟内知道该改哪里。

**Effort:** S
**Priority:** P2
**Depends on:** 当前 ads provider/zone 首版落地完成

### Ads policy 层评估

**What:** 在 ads provider/zone 首版稳定后，评估是否需要第二阶段的 ads policy 层。

**Why:** 当前计划明确把按页面类型、设备、实验桶的投放策略排除在首版之外，这是对的。但一旦真实接流量，下一阶段最容易出现的问题就是“哪些页面该显示广告、哪些设备该关闭、哪些 zone 只在特定场景生效”。

**Context:** 这个 TODO 不是要现在实现 policy，而是保留上下文。只有在首版 ads provider/zone 跑通、做过真实使用验证后，才应该评估是否需要把 page/device/experiment 规则升级成显式策略层，避免提前过度设计。

**Effort:** M
**Priority:** P3
**Depends on:** 当前 ads provider/zone 首版落地完成并经过实际流量或真实使用验证

### API 限流升级到跨实例一致性后端

**What:** 为当前进程内限流器补一个跨实例后端方案（Redis/DB），支持多实例部署时的一致限流。

**Why:** 现有实现基于内存 `Map`，单实例内语义正确，但在多实例/多区域部署下无法形成全局一致的节流与并发控制，存在被绕过风险。

**Context:** 本轮结构级重构已经把限流逻辑收敛到 4 类显式限流器（Cooldown/FixedWindowAttempt/FixedWindowQuota/DualConcurrency），为后续切换共享状态后端提供了统一替换点。后续实施时优先保持现有路由 429 文案与 data 语义不变，仅替换状态存储与原子更新机制。

**Effort:** M
**Priority:** P1
**Depends on:** 当前限流器重构在生产稳定运行，且确认存在多实例一致性需求

### i18n 路由 namespace 契约守卫

**What:** 增加一套“路由路径 -> namespace 集合”的契约守卫测试，覆盖主要路由族并在新增路由时强制补齐规则。

**Why:** i18n 分发表改为规则表后，核心风险从“分支难读”转为“新增路由忘记补规则”，这类问题通常不会直接抛错，而是静默缺文案。

**Context:** 本轮已补关键路径测试，但仍依赖维护者手工补规则。后续建议在契约测试中维护一份最小路由清单，按 admin/settings/activity/blog/ai/docs/public 等族校验 namespace 结果与顺序，避免规则漂移。

**Effort:** S
**Priority:** P2
**Depends on:** 当前 i18n 规则表稳定落地并冻结首版优先级

## Completed
