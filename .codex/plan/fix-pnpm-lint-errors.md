# 任务：修复 pnpm lint error（fix-pnpm-lint-errors）

## 背景

- 项目使用 Next.js 16 + React 19 + ESLint 9（flat config，`eslint-config-next/core-web-vitals`）。
- 运行 `pnpm lint` / `eslint . --quiet` 时存在 34 个 error、若干 warning。
- 目标：在不引入新问题的前提下，清零所有 error，保证 `pnpm lint` 退出码为 0；warning 先分类与给出建议即可。

## 错误分类（仅 error）

1. `@next/next/no-assign-module-variable`
   - 文件：`src/core/theme/index.ts`
   - 问题：使用 CommonJS 风格（给 `module` 赋值），与 Next 推荐的 ESM 导出方式冲突。

2. `react/display-name`
   - 文件：`src/mdx-components.tsx`
   - 问题：存在被识别为 React 组件的匿名导出，未显式命名，影响调试体验。

3. `react-hooks/set-state-in-effect`
   - 文件（示例）：  
     - `src/shared/blocks/common/*`：`copyright.tsx`
     - `src/shared/blocks/common/image-uploader.tsx`
     - `src/shared/blocks/common/locale-detector.tsx`
     - `src/shared/blocks/common/locale-selector.tsx`
     - `src/shared/components/ui/sonner.tsx`
     - `src/shared/hooks/use-media-query.ts`
     - `src/shared/hooks/use-media.ts`
     - `src/themes/default/blocks/header.tsx`
   - 问题：在 `useEffect` 本体中同步调用 `setState`，不符合 React 19 hooks 规则与官方 “You might not need an Effect” 指南，可能导致级联渲染。

4. `react-hooks/purity`
   - 文件：`src/shared/blocks/layout/sidebar.tsx`
   - 问题：在 `useMemo` 等 hook 中调用 `Math.random()` 等非纯函数，违反 hooks 纯度要求。

## 计划步骤

1. 修复 Next 模块导出问题（`src/core/theme/index.ts`）
   - 分析 `module` 相关用法。
   - 改为 ESM 导出（`export const` / `export default`），保持对外 API 不变。

2. 修复 React 组件 displayName（`src/mdx-components.tsx`）
   - 识别匿名组件导出。
   - 改为具名组件或显式设置 `displayName`。

3. 批量修复 `react-hooks/set-state-in-effect`
   - 根据 React 官方文档 “You might not need an Effect”：
     - 派生状态：去掉 effect，直接在 render 中计算。
     - 初始化一次的场景：使用 `useState` lazy initializer 或合并到初始值逻辑。
     - 订阅外部系统（`matchMedia`、locale）：effect 中只负责订阅/解绑，真正的 `setState` 放在事件回调中。
   - 保证原有语义和 UX 行为不变或更合理。

4. 修复 hooks 纯度问题（`react-hooks/purity`）
   - 将 `Math.random()` 等非纯调用移出 hook 计算：
     - 使用 `useState` lazy 初始值或 `useRef` 固定一次性随机数；
     - 或使用模块级常量（若业务可接受）。

5. 反复验证与微调
   - 每完成一批修改后运行 `pnpm exec eslint . --quiet`。
   - 直至所有 error 清零，然后运行 `pnpm lint` 完整检查。
   - 对 warning 做简单分类和建议，不强制修改。

