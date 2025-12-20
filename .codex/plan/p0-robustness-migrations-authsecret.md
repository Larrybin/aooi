# P0 健壮性修复：DB 迁移前置 + Schema 自检 + 生产 Auth Secret 强校验

## 背景与根因

- 线上/本地已出现错误：`column role.deleted_at does not exist`。
- 根因：`src/shared/services/rbac.ts` 依赖 `role.deleted_at`（`src/config/db/schema.ts` 已定义），但数据库未应用迁移 `src/config/db/migrations/0001_nasty_vindicator.sql`（初始迁移 `0000` 创建 `role` 表时未包含该列）。
- 风险：RBAC/鉴权关键路径在 schema 漂移的库上直接 500，且错误定位成本高。

## 目标

- 将“schema 漂移”从运行时故障转为部署/启动阶段可行动的 fail-fast。
- 生产环境强制 `BETTER_AUTH_SECRET/AUTH_SECRET` 非空，避免鉴权不稳定/不安全的带病运行。

## 方案（已确认：方案 1）

1. 迁移作为部署/启动前置：发布前必须执行 `pnpm db:migrate`。
2. 启动/健康检查阶段 schema 自检：检查 `role.deleted_at` 是否存在，不存在则 fail-fast 并给出修复指引。
3. 生产环境强制 auth secret 非空：缺失则 fail-fast 并给出修复指引。

## 执行步骤（原子化）

1. 新增 Next.js instrumentation（启动钩子）
   - 文件：`src/instrumentation.ts`
   - 逻辑：
     - 在 `NODE_ENV=production` 下校验 auth secret 非空。
     - 在 `NODE_ENV=production` 且存在 `DATABASE_URL` 时连接 Postgres，校验 `public.role.deleted_at` 存在。
     - 失败时抛出包含“缺失项 + 建议动作（pnpm db:migrate / 配置 env）”的错误。
2. 文档补齐部署前置条件
   - 文件：`README.md`
   - 增加：生产部署必跑 `pnpm db:migrate`；生产必须配置 auth secret。

## 验收/回归

- 未执行迁移 `0001` 的数据库：`next start` 启动阶段直接失败，并输出“缺失 role.deleted_at，建议 pnpm db:migrate”。
- 已执行迁移的数据库：启动通过，RBAC 不再报缺列。
- 生产缺少 `BETTER_AUTH_SECRET/AUTH_SECRET`：启动阶段失败并给出明确提示。

