# P2：类型安全修复（类型逃逸点收敛）

## 背景
- 文档来源：`docs/ROBUSTNESS_AUDIT.md`（P2-1、P2-2）
- 问题：`any` 类型使边界契约不清晰，重构与故障定位困难

## 目标
- P2-A：修复 sign 相关 `onError: (e: any)` → 类型安全回调
- P2-B：修复 generator `params: any` / `options: any` → 具体类型
- 验收：`pnpm lint` + `pnpm build` 通过

## P2-A 实施方案
- 新增 `src/shared/types/auth-callback.ts`：定义 `AuthErrorContext` 接口
- 修改 4 个文件的 `onError` 回调类型

## P2-B 实施方案
- `music.tsx`：定义 `GenerateMusicParams` 本地类型
- `image.tsx`：定义 `GenerateImageOptions` 本地类型

## 文件清单
- 新增：`src/shared/types/auth-callback.ts`
- 修改：`src/shared/blocks/sign/sign-in.tsx`
- 修改：`src/shared/blocks/sign/sign-up.tsx`
- 修改：`src/shared/blocks/sign/sign-in-form.tsx`
- 修改：`src/shared/blocks/sign/social-providers.tsx`
- 修改：`src/shared/blocks/generator/music.tsx`
- 修改：`src/shared/blocks/generator/image.tsx`
- 修改：`docs/ROBUSTNESS_AUDIT.md`

## 验收步骤
- `pnpm lint`
- `pnpm build`
