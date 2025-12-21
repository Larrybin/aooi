# 既有约定与代码模式索引（Conventions Index）

本文件是索引入口：指向仓库中的“单一事实来源”和同类样本，帮助快速对齐既有约定。

## 单一事实来源（优先查这里）
- `docs/CONVENTIONS.md`
- `docs/architecture/shared-layering.md`
- `docs/CODE_REVIEW.md`
- `docs/ARCHITECTURE_REVIEW.md`
- `content/docs/logging-conventions.zh.mdx`
- `content/docs/code-review-checklist.zh.mdx`
- `eslint.config.mjs`

## 模式样本索引（草案，需人工 review）

### SEO / Metadata（Next.js App Router）
- helper：`src/shared/lib/seo.ts`
- 使用 getMetadata 的页面（抽样）：
  - `src/app/[locale]/(landing)/(ai)/ai-image-generator/page.tsx`
  - `src/app/[locale]/(landing)/(ai)/ai-music-generator/page.tsx`
  - `src/app/[locale]/(landing)/blog/page.tsx`
  - `src/app/[locale]/(landing)/pricing/page.tsx`
  - `src/app/[locale]/(landing)/showcases/page.tsx`
  - `src/app/[locale]/layout.tsx`
- 手写 generateMetadata 的页面（抽样）：
  - `src/app/[locale]/(auth)/forgot-password/page.tsx`
  - `src/app/[locale]/(auth)/reset-password/page.tsx`
  - `src/app/[locale]/(auth)/sign-in/page.tsx`
  - `src/app/[locale]/(auth)/sign-up/page.tsx`
  - `src/app/[locale]/(docs)/docs/[[...slug]]/page.tsx`
  - `src/app/[locale]/(landing)/(ai)/ai-image-generator/page.tsx`
  - `src/app/[locale]/(landing)/(ai)/ai-music-generator/page.tsx`
  - `src/app/[locale]/(landing)/[slug]/page.tsx`

### Route Handlers（src/app/**/route.ts）
- `src/app/ads.txt/route.ts`
- `src/app/api/ai/generate/route.ts`
- `src/app/api/ai/query/route.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/chat/info/route.ts`
- `src/app/api/chat/list/route.ts`
- `src/app/api/chat/messages/route.ts`
- `src/app/api/chat/new/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/config/get-configs/route.ts`
- ...（共 18 个）

### 支付集成（extensions/payment）
- `src/extensions/payment/creem.ts`
- `src/extensions/payment/index.ts`
- `src/extensions/payment/paypal.ts`
- `src/extensions/payment/providers.ts`
- `src/extensions/payment/stripe.ts`
- `src/extensions/payment/types.ts`

## 说明
- 本草案用于“生成初稿 + 人工 review 合入”。请将缺失的主题与关键样本补齐到 `docs/CONVENTIONS.md`。
- 如需 CI 校验，可在 CI 中运行 `node scripts/conventions-index.mjs --check`。
