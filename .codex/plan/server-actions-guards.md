# 上下文

目标：为仓库中内联 Server Actions（`'use server'`）引入可复用的 action 护栏与服务端校验，满足 checklist 的强制项与高风险区要求：

- 把 Server Actions 当作公开 API endpoint：action 内必须复核鉴权与权限（Context7/Next.js 最佳实践）。
- 对 `FormData` 做服务端 Zod 校验（不信任客户端与 `passby`）。
- **不改变现有 UI 行为**：保持返回结构 `{status,message,redirect_url?}`；鉴权失败/权限不足文案按用户确认 `A+A`：`no auth` / `no permission`；不在 action 内做 redirect。

范围：包含 `'use server'` 的 15 个页面（admin：categories/posts/roles/users/settings；landing/settings：profile/security/apikeys/billing）。

# 计划摘要

1. 新增 `src/shared/lib/action/*`：提供 `withAction()`（统一 try/catch 与日志）、`ActionError`、`parseFormData()`（FormData→object→zod safeParse）、`requireActionUser()` 与 `requireActionPermissions()`（基于 session 与 RBAC）。
2. 逐个改造 15 处页面内联 action：
   - action 开头 `requireActionUser()`；admin action 额外 `requireActionPermissions(...)`。
   - 不信任 `passby`：对资源对象（apikey/role/user/category/subscription）改为在 action 内以闭包的 id/searchParams 重新查询并校验归属。
   - 使用 `parseFormData(formData, schema)` 做服务端校验；数组字段（roles/permissions）用 JSON 字符串 schema 解析。
   - 保持原成功/失败 message 与 redirect_url 行为（toast/跳转联动不变）。
3. 运行 `pnpm lint` 与 `pnpm build:fast` 验证。

