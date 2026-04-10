# TODOS

## Review

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

## Completed
