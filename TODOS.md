# TODOS

## Review

## Completed

### Payment webhook 回放与未知事件审计补偿工具

**What:** 已落地 payment webhook inbox、canonical event 持久化、admin replay/compensation 页面，以及基于已落库 canonical event 的执行入口。

**Why:** 现在 live webhook、未知事件审计、失败重试与人工补偿已经收敛到同一条账务修复链路，不再依赖临时脚本。

**Context:** `POST /api/payment/notify/[provider]` 现在会先把原始 body/headers 写入 `payment_webhook_inbox`，再解析成 canonical `PaymentEvent` 并执行业务处理；admin `/admin/payments/replay` 提供预览筛选、批量 replay/compensation、操作备注和执行结果回显；失败状态与 attempt 计数统一落回 inbox。

**Effort:** M
**Priority:** P1
**Status:** Done

### API 限流升级到跨实例一致性后端

**What:** 已把限流状态从进程内 `Map` 收敛为可切换 store，并默认接入基于数据库事务与 advisory lock 的跨实例一致性后端。

**Why:** 多实例部署下的节流、失败窗口和并发上限现在能够共享状态，不再被单实例内存隔离绕过。

**Context:** 四类限流器（`Cooldown` / `FixedWindowAttempt` / `FixedWindowQuota` / `DualConcurrency`）都已改为异步 store 模式；新增 `api_rate_limit_state` 表和 DB store；邮件、AI、上传、reset password 等入口已切到统一后端；仅保留 memory store 作为测试/注入实现。

**Effort:** M
**Priority:** P1
**Status:** Done

### Cloudflare Admin Settings Phase 2 写路径验证

**What:** 已为 Cloudflare `admin/settings/**` 落地第二阶段验证，覆盖关键写操作、配置保存、配置回读、provider 级 happy/denied path，以及执行后状态清理。

**Why:** 这条链路现在不再停留在“页面能打开”的只读 smoke，而是实际验证了配置提交在 Cloudflare Worker 上的可用性。

**Context:** 当前 `test:cf-admin-settings-smoke` 已覆盖 `general` 保存成功/失败与回读一致、`auth` 的 Google/GitHub happy/denied path、`storage` 配置保存与上传 happy/denied path，并在结束后恢复 baseline 配置。

**Effort:** M
**Priority:** P1
**Status:** Done
