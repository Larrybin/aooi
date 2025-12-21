---
title: 图片优化（方案 2 / Landing 优先）
status: in_progress
---

## 背景与目标

- 优先优化首页（landing）的图片加载与 LCP。
- 约束：不改 `next.config.mjs` 的 `images.remotePatterns`；不处理 MDX 图片；无用户上传/任意外链图片（但代码里可能存在 remote svg/logo、AI 结果 URL，需要保证类型/运行不报错）；当前仅跑 Vercel。
- 策略：方案 2（在统一走 `next/image` 的基础上，进一步做源图片的尺寸收敛/压缩），并对 LCP 候选图采用更激进的 `priority`。

## 执行清单（原子化）

1. 盘点 landing 配置引用的图片 `src`，统计体积与像素尺寸。
2. Hero（LCP 候选图）启用 `priority`，并确保 `fill` 场景提供 `sizes`。
3. 收敛明显“展示尺寸≪源图”的热点（优先 logo）。
4. 对 landing 相关截图/插图做源图片尺寸收敛与压缩（不改 `next.config.mjs`）。
5. favicon 替换纳入范围，确保走 App Router 文件式 metadata。
6. 本地构建与基础校验（`pnpm build`）。

## 完成记录（本次对话）

- 已完成：步骤 1、2、3、4（部分）、5（已有文件式 favicon）。
- 待完成：步骤 4（继续评估是否需要进一步压缩）、6（本地构建与基础校验）。

