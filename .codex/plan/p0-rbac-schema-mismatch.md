# P0：RBAC 在 schema 缺失时输出可理解错误（方案 1）

## 目标

当数据库缺少 `public.role.deleted_at`（迁移未应用）时：

- **允许应用启动**（不改启动期行为）
- **首次触发 RBAC 权限查询时失败**（不做降级绕过）
- **错误信息可理解、可操作**（提示 `pnpm db:migrate`）
- **生产环境不向用户泄漏内部细节**（详细信息进 server log）

## 范围

- 仅 `src/`
- 不引入新的 instrumentation 开关

## 实施步骤

1. 在 `src/shared/services/rbac.ts` 增加“缺列错误识别”与“错误构造”
   - 识别 Postgres `42703`（missing_column）且指向 `role.deleted_at`
   - dev/非生产：抛出包含迁移指引的错误信息
   - production：抛出通用错误信息，并记录详细日志（含迁移指引）
2. 在 `getUserPermissionCodes()` 的 DB 查询处捕获错误并转换
3. 跑 `pnpm lint` 与 `pnpm build` 验证

## 验收

- 缺少 `role.deleted_at` 时触发权限检查：
  - 开发环境：错误信息包含 `pnpm db:migrate` 与缺失列提示
  - 生产环境：用户侧错误不包含列名/SQL 细节，但服务端日志包含迁移指引

