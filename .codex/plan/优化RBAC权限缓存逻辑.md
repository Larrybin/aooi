---
task: 优化RBAC权限缓存逻辑
mode: 执行前计划存档
principles: [SOLID, KISS, DRY, YAGNI]
scope:
  - src/shared/services/rbac.ts
non-goals:
  - 引入跨请求缓存/TTL缓存
  - 修改数据库schema或迁移
  - 批量重构调用方
---

## 背景与问题

- 目标：采用“强一致”策略（权限/角色变更在下一次请求立即生效），同时减少一次调用内的重复查库。
- Context7/Next.js 最佳实践要点：Route Handlers 不在 React 组件树内，Request Memoization 不适用；在可被 Route Handlers 调用的共享模块里使用 `react/cache` 可能造成跨请求陈旧结果，不符合强一致。

### 已识别问题

1. `src/shared/services/rbac.ts` 使用 `react` 的 `cache(...)` 包装 RBAC 查询与判断，缺少显式失效机制，存在权限变更后陈旧读取风险。
2. `getUserRoles` 的 expires 条件误用 JS `||`（非 drizzle 表达式组合），导致过期过滤逻辑不正确。
3. `hasAnyPermission/hasAllPermissions` 通过循环调用 `hasPermission` 造成重复查库；移除 cache 后会放大性能问题。

## 执行计划（最小侵入）

仅修改 `src/shared/services/rbac.ts`：

1. 移除 `react` 的 `cache` 使用，改为普通 async 函数/常量函数导出，杜绝跨请求陈旧数据。
2. 修复 `getUserRoles` 的过期判断：使用 drizzle 的 `or(isNull(...), gt(...))`。
3. 增加单次查询获取权限码列表（基于 join：`user_role -> role -> role_permission -> permission`）。
4. 将 `hasPermission/hasAnyPermission/hasAllPermissions` 改为：一次查询拿到 permissionCodes 后，在内存里做精确/前缀通配符/`*` 匹配。
5. 保持外部导出 API 名称不变，避免修改调用方。

## 预期收益

- 正确性：权限/角色更新后下一次请求立即生效（强一致）。
- 性能：批量权限判断只查库一次，减少 DB 往返。
- 维护性：修复过期判断 bug，逻辑更清晰。

