---
task: General UI Toggles (BuiltWith/Theme/Social)
status: executing
created_at: 2025-12-16
---

## 背景与目标

在 Admin Settings 增加 `General/通用` 配置，统一控制：
- `Built with ❤️ ShipAny` 是否显示（默认关闭）
- `ThemeToggler` 是否显示（默认关闭，所有使用处受控）
- 社交图标（默认关闭，单个图标开关 + URL；支持未来扩展如 YouTube/Pinterest/Facebook）

约束：
- Admin 为准（覆盖 i18n 里 landing/footer 与 admin/sidebar 的显示配置）
- Admin Sidebar Footer 的 Home 图标不纳入控制
- 社交图标启用时必须提供 URL（支持 `mailto:`）

## 实施方案（KISS）

复用现有 KV `config(name,value)`：
- `general_built_with_enabled`: 'true' | 'false'
- `general_theme_toggle_enabled`: 'true' | 'false'
- `general_social_links_enabled`: 'true' | 'false'
- `general_social_links`: JSON string（数组）

前端通过 `/api/config/get-configs` + `publicSettingNames` 获取开关，组件内部自控渲染，避免 Server Component 读取 DB 带来的静态化/缓存风险。

## 执行步骤

1. 在 `src/shared/services/settings.ts` 增加 `General` tab、`general_ui` group 与字段，并将 key 加入 `publicSettingNames`
2. 增加通用解析与校验：
   - Zod schema 校验 `general_social_links`（保存时）
   - 客户端解析并过滤 enabled items（渲染时）
3. `ThemeToggler` / `BuiltWith` / `GeneralSocialLinks` 在组件内部读取 `AppContext.configs` 决定是否渲染
4. 接入：
   - `src/themes/default/blocks/footer.tsx` 使用通用组件，忽略 `footer.social`
   - `src/shared/blocks/dashboard/sidebar-footer.tsx` 保留 Home，其余社交图标来自通用配置
   - `src/config/locale/messages/*/admin/sidebar.json` footer nav 仅保留 Home
5. 补齐 i18n 文案与 `README.md` 说明
6. 运行 `pnpm lint` 与 `pnpm build` 验证

