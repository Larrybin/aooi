---
task: P1（方案A）：RBAC Guard fail-fast + rbac.ts 内部职责分区
mode: 执行计划存档
scope:
  include:
    - src/shared/services/rbac_guard.ts
    - src/shared/services/rbac.ts
  exclude:
    - raphael-starterkit-v1-main/**
principles: [SOLID, KISS, DRY, YAGNI]
constraints:
  - 对外导出 API（路径/函数名/签名/返回值）完全不变
  - 不引入新的 env
  - 生产默认 fail-fast（抛错中止）
future:
  - 方案B：deleteRole 软删除并支持同名重建（将需要 DB 层唯一约束策略调整/迁移）
validation:
  - pnpm lint
  - npx tsc --noEmit
  - pnpm build
---

## 背景与问题

1. `rbac_guard` 存在默认跳转不明确风险：未传 `redirectUrl` 时可能构造空 href（隐性行为/潜在运行时异常）。
2. `rbac.ts` 多职责混杂（CRUD/查询、权限匹配、request-scope 缓存），后续演进与审计语义调整成本较高。

## 执行步骤

### 1) 修复 `rbac_guard` 默认策略（P1）

- 文件：`src/shared/services/rbac_guard.ts`
- 目标：只有在调用方显式提供 `redirectUrl` 时才执行 redirect；否则直接抛 `PermissionDeniedError`（fail-fast）。
- 保持：`requirePermission/requireAnyPermission/requireAllPermissions/requireRole/requireAnyRole` 的对外行为不变。

### 2) `rbac.ts` 内部职责分区（不拆文件、不改导出）

- 文件：`src/shared/services/rbac.ts`
- 方法：仅做私有函数归类/局部重构（不改变 exports）
  - Repo/Queries：DB CRUD 与查询拼装
  - Matching：权限通配匹配算法
  - Checker：request-scope 的 permissionCodes memoization

### 3) 验收

按顺序执行：

1. `pnpm lint`
2. `npx tsc --noEmit`
3. `pnpm build`

