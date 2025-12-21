---
task: 修复 @typescript-eslint/no-explicit-any（方案 1）
scope:
  - src/core/db/index.ts
  - src/core/db/schema-check.ts
  - src/extensions/ai/kie.ts
  - src/shared/blocks/common/smart-icon.tsx
  - src/shared/components/ai-elements/prompt-input/speech.tsx
  - src/shared/components/ui/animated-grid-pattern.tsx
  - src/shared/contexts/app.tsx
  - src/shared/lib/api/route.ts
  - src/shared/lib/seo.ts
  - src/shared/services/rbac_guard.ts
principles:
  - KISS: 仅做类型层最小改动，不改运行时行为
  - YAGNI: 不通过放宽 lint 选项绕过问题
  - DRY: 复用现有类型/最小公共类型
  - SOLID: 明确边界层（I/O/动态/第三方）类型收口
references:
  - typescript-eslint: no-explicit-any 文档与 Avoiding anys 博文（优先 unknown，避免 any 传染）
  - TypeScript: unknown 为 any 的安全替代
---

## 目标

- `pnpm lint` 中 `@typescript-eslint/no-explicit-any` errors 归零。
- 不新增全局规则 disable；仅在确有必要时局部收口（本任务预期不需要）。

## 执行步骤（原子化）

1. `src/core/db/index.ts`
   - 将 Proxy/Reflect 包装器中的 `(...args: any[])` 替换为 `(...args: unknown[])`。
   - 必要时用最小断言收口 `Reflect.apply` 的 callable 类型。

2. `src/core/db/schema-check.ts`
   - `SqlTag` 的 `...values` 改为 `unknown[]`，返回 `Promise<unknown>`。
   - `PostgresSqlClient.end` 的 rest 参数改为 `unknown[]`。

3. `src/extensions/ai/kie.ts`
   - 将 API 返回 `data?: any` 改为最小可用结构类型（其余使用 `unknown/Record<string, unknown>`）。
   - 保持现有错误处理与字段访问逻辑不变。

4. `src/shared/blocks/common/smart-icon.tsx`
   - 用更具体的 icon props（基于 `ComponentPropsWithoutRef<'svg'>`）替代 `any`。
   - 删除 `[key: string]: any`，让 `...props` 走 SVG props。

5. `src/shared/components/ai-elements/prompt-input/speech.tsx`
   - 事件回调返回类型从 `any` 改为 `void`。

6. `src/shared/components/ui/animated-grid-pattern.tsx`
   - `strokeDasharray?: any` 改为 `ComponentPropsWithoutRef<'path'>['strokeDasharray']`。

7. `src/shared/contexts/app.tsx`
   - `OneTapCapable.oneTap` 改为最小入参对象签名，返回 `Promise<unknown>`。
   - `onPromptNotification(notification)` 参数改为 `unknown`。

8. `src/shared/lib/api/route.ts`
   - `withApi` 的泛型约束从 `any[]` 改为 `unknown[]`。

9. `src/shared/lib/seo.ts`
   - `translatedMetadata: any` 改为 `Partial<{title;description;keywords}>`。

10. `src/shared/services/rbac_guard.ts`
   - `withPermission/withRole` 泛型约束从 `any[]/any` 改为 `unknown[]/unknown`。

11. 验证
   - 运行 `pnpm lint`，确认 `@typescript-eslint/no-explicit-any` errors 为 0（warnings 不在本任务范围）。

