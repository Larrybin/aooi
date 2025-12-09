# 任务：修复 pnpm lint warning（fix-pnpm-lint-warnings）

## 背景

- 项目已使用 ESLint 9 + `eslint-config-next/core-web-vitals`，error 已全部清零。
- 运行 `pnpm lint` 仍有 32 条 warning，主要集中在：
  - `react-hooks/exhaustive-deps`：effect/回调依赖不完整或不稳定；
  - `@next/next/no-img-element`：直接使用 `<img>` 而非 `next/image`；
  - `jsx-a11y/alt-text`：图片缺少 `alt` 文本；
  - 若干 hooks 与清理细节（ref 清理、unused eslint-disable）。
- 目标：在不引入新问题的前提下，尽量修复所有 warning，使 `pnpm lint` 无 warning。

## Warning 分类（概览）

1. `react-hooks/exhaustive-deps`
   - 聊天相关：chat page / chat box / generator / library。
   - 内容编辑：`markdown-editor.tsx`。
   - 导航/标签：`tabs.tsx`。
   - 生成器：`generator/image.tsx`、`generator/music.tsx`。
   - AI 组件：`message.tsx`、`prompt-input.tsx`、`particles.tsx`、`animated-grid-pattern.tsx`。

2. `@next/next/no-img-element`
   - 图片组件：ImageUploader、AI message 附件、模型选择、Prompt 输入。
   - 营销/展示：avatar-circles、blog/blog-detail/logos/testimonials 等块。

3. `jsx-a11y/alt-text`
   - 表格图片单元格：table index 中的 image 封装（内部需确保 alt 合规）。

4. 其它
   - `animated-grid-pattern.tsx`：ref cleanup 使用方式。
   - `reasoning.tsx`：多余的 `eslint-disable`。

## 修复策略（基于 React / ESLint 官方最佳实践）

1. 对于 `react-hooks/exhaustive-deps`
   - 原则：effect 依赖数组必须真实反映 effect 使用到的所有响应式值。
   - 优先方案：
     - 将 effect 中使用的函数通过 `useCallback` 稳定化，然后加入依赖；
     - 或将逻辑移动到 effect 内部，依赖使用的 state/props；
     - 对于纯“初始化一次”的逻辑，优先使用 lazy initializer 或在 render 中计算，避免 effect。

2. 对于 `@next/next/no-img-element`
   - 原则：首屏和重要内容优先使用 `next/image`，其余按需求逐步替换。
   - 简化策略：
     - 在局部组件中引入 `Image` 并替换 `<img>`；
     - 使用与 Tailwind 类名相匹配的 `width`/`height`（例如 `h-10 w-10` => 40x40）；
     - 对 purely decorative 场景可考虑 `alt=""` 或评估是否保留 `<img>` + 局部 disable（仅当确实需要）。

3. 对于 `jsx-a11y/alt-text`
   - 原则：所有 `<img>` / 自定义 Image 组件必须有合理的 `alt`，纯装饰用空字符串。
   - 检查封装组件（如 `Table` 的 `Image` 单元格）确保它们内部遵守规则。

4. 对于 hooks 清理等细节
   - `animated-grid-pattern.tsx`：在 effect 内缓存 `containerRef.current` 到局部变量，清理时仅使用该变量。
   - `reasoning.tsx`：移除不再需要的 `eslint-disable`，或只保留确有必要的豁免。

## 执行步骤

1. 修复所有 `react-hooks/exhaustive-deps` warning
   - chat 系列：补上 `fetchChat` / `setChat` / `fetchChats` / 分页相关依赖，必要时用 `useCallback` 包装。
   - markdown-editor / tabs：重构为显式依赖或适当改为 lazy 初始化，避免“骗过”依赖数组。
   - generator image/music：确保轮询函数与状态更新的依赖闭包稳定。
   - ai message / prompt-input / particles / animated-grid-pattern：按 React 官方指南重构 effect 结构或使用 `useMemo`/`useCallback` 稳定依赖。

2. 修复图片相关 warning
   - 按组件分批替换 `<img>` 为 `next/image`，或在明确需要时配置合理的 alt + 局部豁免。
   - 确保所有图片有合适 `alt` 文本。

3. 清理 hooks 相关细节
   - `animated-grid-pattern.tsx` 的 ref cleanup；
   - `reasoning.tsx` 中多余的 `eslint-disable`。

4. 在每一批修改后运行 `pnpm exec eslint . --quiet`，最终确认 `pnpm lint` 0 warning。

