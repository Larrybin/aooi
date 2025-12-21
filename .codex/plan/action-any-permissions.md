# 上下文

当前 action 护栏已提供：

- `requireActionPermission(userId, PERMISSIONS.X)`（单权限）
- `requireActionPermissions(userId, ...PERMISSIONS.X)`（全部权限）

需要补齐“任一权限即可”的场景封装：`requireActionAnyPermissions(userId, ...PERMISSIONS.X)`，底层使用 RBAC 的 `hasAny`，并保持失败信息一致返回 `no permission`。

# 计划摘要

1. 在 `src/shared/lib/action/guard.ts` 增加 `requireActionAnyPermissions(userId, ...codes)`，类型沿用 `PermissionCode`。
2. `pnpm lint` 与 `pnpm build:fast` 验证。

