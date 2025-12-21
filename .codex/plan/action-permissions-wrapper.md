# 上下文

在已完成的 Server Actions 护栏中，权限校验目前形态为：

```ts
await requireActionPermissions(user.id, [PERMISSIONS.A, PERMISSIONS.B]);
```

用户希望抽象为更统一的调用方式：`requireActionPermissions(userId, PERMISSIONS.*)`，减少数组样板并提升可读性，同时保持既有行为（鉴权/权限失败返回 `no auth` / `no permission`）。

# 计划摘要

1. 在 `src/shared/lib/action/guard.ts` 中引入 `PermissionCode` 类型（基于 `src/shared/constants/rbac-permissions.ts` 的 `PERMISSIONS`），并将 `requireActionPermission/requireActionPermissions` 的签名升级为 rest 参数形式：
   - `requireActionPermission(userId, PERMISSIONS.X)`
   - `requireActionPermissions(userId, PERMISSIONS.X, PERMISSIONS.Y, ...)`
2. 迁移当前使用数组调用的页面（如 admin settings/edit-roles），保持语义不变。
3. `pnpm lint` 与 `pnpm build:fast` 验证。

