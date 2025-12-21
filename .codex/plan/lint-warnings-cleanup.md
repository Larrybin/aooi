# lint-warnings-cleanup

> 生成时间：2025-12-21 10:29:28

## 目标与成功标准
- `pnpm lint` 输出为 0 warnings / 0 errors

## 项目画像（摘要）
- 技术栈/框架/包管理：Next.js App Router + TypeScript + ESLint + Prettier + pnpm
- 相关模块/入口：`eslint.config.mjs`、`src/app/**`、`src/shared/**`、`src/extensions/**`

## 约束与假设
- 约束：不引入新依赖；不做全仓库批量格式化；仅收敛 lint warning（以 `pnpm lint` 为准）
- 假设：允许对“有意不用”的变量/参数采用 `^_` 前缀约定

## 关键决策（含理由）
- 决策：在 `eslint.config.mjs` 统一配置 `@typescript-eslint/no-unused-vars` 忽略 `^_` 前缀
  - 依据：与现有 `_passby` 等命名风格一致；可读性强；不降低规则覆盖面
  - 影响：对“确实不用”的变量/参数统一改为 `_xxx`，减少噪音但保留真实 unused 提示

## 备选方案（否决原因）
- 方案：直接关闭 `@typescript-eslint/no-unused-vars`
  - 否决原因：会掩盖真实的无用导入/死代码，降低 lint 的信噪比

## 实施步骤（已批准/已执行）
1. 运行 `pnpm lint` 收集 warning 列表并按类型分组（未使用导入/变量/参数/死代码）
2. 在 `eslint.config.mjs` 添加 `^_` 忽略规则，并在代码中对“有意不用”统一前缀
3. 删除明显死代码与未使用导入（保持行为等价）
4. 复跑 `pnpm lint` 验证归零

## 验收清单
- [x] `pnpm lint` 无 warning

## 验证/命令记录
- `pnpm lint` → ✅ 通过（0 warnings / 0 errors）
- `pnpm format:check` → ❌ 未通过（提示 217 个文件存在 Prettier 风格差异；疑似为既有存量问题，未在本任务内批量修复）

## 变更文件
- `eslint.config.mjs`（修改）
- `src/app/[locale]/(admin)/admin/chats/page.tsx`（修改）
- `src/app/[locale]/(admin)/admin/roles/actions.ts`（修改）
- `src/app/[locale]/(docs)/layout.config.tsx`（修改）
- `src/app/[locale]/(landing)/(ai)/ai-audio-generator/page.tsx`（修改）
- `src/app/[locale]/(landing)/(ai)/ai-chatbot/page.tsx`（修改）
- `src/app/[locale]/(landing)/(ai)/ai-video-generator/page.tsx`（修改）
- `src/app/[locale]/(landing)/activity/ai-tasks/[id]/refresh/page.tsx`（修改）
- `src/app/[locale]/(landing)/activity/ai-tasks/page.tsx`（修改）
- `src/app/[locale]/(landing)/activity/chats/page.tsx`（修改）
- `src/app/[locale]/(landing)/blog/[slug]/page.tsx`（修改）
- `src/app/[locale]/(landing)/settings/billing/cancel/page.tsx`（修改）
- `src/app/[locale]/(landing)/settings/billing/retrieve/page.tsx`（修改）
- `src/app/[locale]/(landing)/settings/invoices/retrieve/page.tsx`（修改）
- `src/app/[locale]/(landing)/settings/security/page.tsx`（修改）
- `src/core/i18n/request.ts`（修改）
- `src/extensions/ai/replicate.ts`（修改）
- `src/extensions/payment/creem.ts`（修改）
- `src/extensions/payment/paypal.ts`（修改）
- `src/extensions/payment/stripe.ts`（修改）
- `src/shared/blocks/chat/box.tsx`（修改）
- `src/shared/blocks/chat/history.tsx`（修改）
- `src/shared/blocks/chat/input.tsx`（修改）
- `src/shared/blocks/chat/library.tsx`（修改）
- `src/shared/blocks/chat/suggestions.tsx`（修改）
- `src/shared/blocks/common/audio-player.tsx`（修改）
- `src/shared/blocks/common/image-uploader.tsx`（修改）
- `src/shared/blocks/common/mdx-content.tsx`（修改）
- `src/shared/blocks/common/pagination.tsx`（修改）
- `src/shared/blocks/console/layout.tsx`（修改）
- `src/shared/blocks/dashboard/header.tsx`（修改）
- `src/shared/blocks/dashboard/nav.tsx`（修改）
- `src/shared/blocks/form/checkbox.tsx`（修改）
- `src/shared/blocks/form/form-card.tsx`（修改）
- `src/shared/blocks/form/index.tsx`（修改）
- `src/shared/blocks/form/input.tsx`（修改）
- `src/shared/blocks/form/markdown.tsx`（修改）
- `src/shared/blocks/form/select.tsx`（修改）
- `src/shared/blocks/form/switch.tsx`（修改）
- `src/shared/blocks/form/upload-image.tsx`（修改）
- `src/shared/blocks/generator/music.tsx`（修改）
- `src/shared/blocks/payment/payment-providers.tsx`（修改）
- `src/shared/blocks/sign/sign-in-form.tsx`（修改）
- `src/shared/blocks/sign/sign-in.tsx`（修改）
- `src/shared/blocks/sign/sign-up.tsx`（修改）
- `src/shared/blocks/sign/social-providers.tsx`（修改）
- `src/shared/blocks/table/copy.tsx`（修改）
- `src/shared/blocks/table/dropdown.tsx`（修改）
- `src/shared/blocks/table/index.tsx`（修改）
- `src/shared/blocks/table/json-preview.tsx`（修改）
- `src/shared/blocks/table/user.tsx`（修改）
- `src/shared/components/ai-elements/message.tsx`（修改）
- `src/shared/components/ai-elements/prompt-input/form.tsx`（修改）
- `src/shared/components/ui/text-effect.tsx`（修改）
- `src/shared/models/chat_message.ts`（修改）
- `src/shared/models/credit.ts`（修改）
- `src/shared/models/order.ts`（修改）
- `src/shared/models/post.tsx`（修改）
- `src/themes/default/blocks/features-list.tsx`（修改）
- `src/themes/default/blocks/page-detail.tsx`（修改）
- `src/themes/default/blocks/pricing.tsx`（修改）
- `src/themes/default/pages/blog-detail.tsx`（修改）
- `src/themes/default/pages/blog.tsx`（修改）
- `src/themes/default/pages/landing.tsx`（修改）
- `src/themes/default/pages/page-detail.tsx`（修改）
- `src/themes/default/pages/pricing.tsx`（修改）
- `src/themes/default/pages/showcases.tsx`（修改）

## 风险与回滚
- 风险：主要为“删未用变量/导入、简化死代码”类型变更，理论上应行为等价；但若有隐藏的副作用依赖（极少见），可能触发运行时差异
- 回滚：对变更文件执行 `git restore -- <path>` 或整体 `git restore .`（注意当前工作区可能存在与本任务无关的既有改动）
