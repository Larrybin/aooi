# Password Reset（仅找回密码邮件）落地计划

## 目标

在现有 Better Auth 集成基础上，启用 Email/Password 的找回密码邮件能力：通过 `emailAndPassword.sendResetPassword` 回调调用项目现有 `getEmailService()` 发送重置链接邮件，并补齐最小 UI（发起找回 + 重置密码）形成可用闭环。

## 范围（做 / 不做）

- 做：
  - Better Auth `sendResetPassword` 回调接入邮件发送
  - 新增重置密码邮件模板（React email payload）
  - 新增 `/forgot-password`、`/reset-password` 两个页面与表单组件
  - 登录页开放“忘记密码？”入口
- 不做：
  - Email verification / OTP
  - rateLimit / Turnstile / 风控增强

## 关键文件与改动点

- `src/core/auth/config.ts`
  - 在 `getAuthOptions()` 的 `emailAndPassword` 内新增 `sendResetPassword`，使用 `getEmailService()` 发送邮件
  - 仅在 `email_auth_enabled` 开启时挂载 `sendResetPassword`，避免关闭邮箱登录时仍能发起重置
  - 发送逻辑不阻塞主流程（避免通过响应时延推断账号存在性）

- `src/shared/content/email/reset-password.tsx`
  - 导出 `buildResetPasswordEmailPayload({ url })`，生成邮件内容 payload（`react` + `text` fallback）

- `src/core/auth/client.ts`
  - 导出 `requestPasswordReset`、`resetPassword`（Better Auth client actions）供 UI 调用

- `src/app/[locale]/(auth)/forgot-password/page.tsx`
- `src/shared/blocks/sign/forgot-password.tsx`
  - 输入邮箱后调用 `requestPasswordReset({ email, redirectTo })`
  - UI 统一提示，不泄露账号是否存在

- `src/app/[locale]/(auth)/reset-password/page.tsx`
- `src/shared/blocks/sign/reset-password.tsx`
  - 从 query 中读取 `token`/`error`，提交新密码调用 `resetPassword({ token, newPassword })`

- `src/shared/blocks/sign/sign-in.tsx`
- `src/shared/blocks/sign/sign-in-form.tsx`
  - 启用“忘记密码？”链接，指向 `/forgot-password`

- `src/config/locale/messages/en/common.json`
- `src/config/locale/messages/zh/common.json`
  - 增加 forgot/reset 页面所需的最小文案 key

## 验收标准

- 登录页可进入找回密码页面
- 找回密码提交后始终给出统一提示（不泄露账号存在性）
- 邮件可发出并包含可用重置链接
- 重置页面可使用 token 设置新密码；完成后可用新密码登录
- 不影响现有登录/注册流程

## 风险与约束

- 邮件发送使用现有 EmailManager；若未配置 provider，应在日志中记录但不影响对外响应
- 不引入额外自建 API，统一走 Better Auth `/api/auth/**`

## 当前状态（已落地）

- 已完成：邮件发送回调 + 邮件模板、找回/重置页面与组件、登录页入口、多语言文案
- 未包含：rateLimit / Turnstile / 风控增强（按范围约束保留）
