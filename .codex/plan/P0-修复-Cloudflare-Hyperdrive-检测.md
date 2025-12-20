---
task: P0 修复：Cloudflare Hyperdrive 检测与连接串选择
mode: 计划（待批准执行）
scope:
  include:
    - src/core/db/index.ts
  exclude:
    - raphael-starterkit-v1-main/**
principles: [SOLID, KISS, DRY, YAGNI]
decision:
  production_policy: fail-fast
  rationale:
    - Cloudflare Workers 部署契约必须具备 Hyperdrive binding，否则宁可失败也不允许静默回退写入错误库/产生脏数据
    - wrangler.toml.example 已明确 [[hyperdrive]] binding = "HYPERDRIVE"
evidence:
  - src/core/db/index.ts:17 当前将 env 写死为空对象，导致 Hyperdrive 永远不可达
  - wrangler.toml.example:10-14 显示 HYPERDRIVE binding 配置方式
validation:
  - npx tsc --noEmit
  - （可选）Cloudflare 预览：wrangler/opennext 预览环境确认命中 “using Hyperdrive connection”
---

## 背景与问题

当前 `src/core/db/index.ts` 在 Cloudflare Workers 分支使用 `const { env } = { env: {} }` 的 stub，导致：

- `HYPERDRIVE` 检测恒为 false
- 即使 Wrangler 配置了 `[[hyperdrive]] binding = "HYPERDRIVE"`，运行时也永远不会使用 Hyperdrive connection string

这属于 **P0**：会造成 Cloudflare 环境下 DB 连接策略与预期不一致，存在稳定性与审计/报表污染风险。

## 目标（不改变对外导出 API）

- `export function db()` 对外签名与调用方式完全不变
- 在 Cloudflare Workers 环境：
  - 必须读取到 `HYPERDRIVE.connectionString`
  - 若读取不到则 **fail-fast 抛错**（不允许静默回退）
- 非 Cloudflare Workers 环境保持当前行为（使用 `envConfigs.database_url` + 现有 singleton/serverless 策略）

## 方案（选定）

方案：在 `db()` 内部以同步方式尝试读取 Workers 的 bindings env，并优先选择 `HYPERDRIVE.connectionString`。

- 优先使用 Workers 提供的 `require('cloudflare:workers')`（在 `nodejs_compat` 下可用）读取 `env`
- 若检测到处于 Cloudflare Workers（或 `cloudflare:workers` 可用）但缺失 `HYPERDRIVE.connectionString`：直接抛错

## 执行步骤（原子化）

1) `src/core/db/index.ts`
   - 新增 `tryGetCloudflareWorkersEnv()`：在 `require` 可用时尝试 `require('cloudflare:workers')` 读取 `env`，失败返回 `null`
2) `src/core/db/index.ts`
   - 替换当前 `env` stub + `isHyperdrive` 分支：
     - 若处于 Cloudflare Workers：强制要求 `env.HYPERDRIVE.connectionString` 存在，否则抛错
     - 存在则覆盖 `databaseUrl` 并记录非敏感日志（不打印连接串）
3) 验证
   - `npx tsc --noEmit`

## 成功标准

- Cloudflare Workers 下缺失 binding 时启动即失败（错误信息可操作）
- Cloudflare Workers 下存在 binding 时走 Hyperdrive（日志可验证）
- Node/Vercel 下行为不变，类型检查通过

