# P0-2：DB 初始化阶段 schema 校验（一次性缓存）

## 背景

来自 `docs/ROBUSTNESS_AUDIT.md`：

- P0-2：`src/instrumentation.ts` 的 schema 校验仅在 production 启用，dev/预发/CI 容易在请求路径才暴露迁移缺失（回归成本高）。

本次选择方案 3：将 schema 校验下沉到 `src/core/db/index.ts` 的 DB 初始化/使用路径，并在进程/Worker 实例内缓存校验结果，避免每请求重复检查。

## 计划

1. 修改 `src/core/db/index.ts`：
   - 增加 module-level 的 `schemaCheckPromise`（一次性缓存）。
   - 增加基于 `information_schema.columns` 的校验：确认 `public.role.deleted_at` 存在。
   - 为 postgres-js client 增加一个轻量 wrapper：所有 SQL 调用会先 `await schemaCheckPromise`。
   - 在创建 postgres client 后立即触发一次 schema check（不阻塞 `db()` 返回），但会阻塞后续 query 执行。
   - 生产环境：对外抛出通用错误，详细信息写入 server log。

2. 保持 `src/instrumentation.ts` 现状（production 启动期检查作为额外兜底）。

3. 验证：
   - `pnpm lint`
   - `pnpm build`
   - 场景验证：DATABASE_URL 缺失 / 迁移未应用 / 正常数据库。
