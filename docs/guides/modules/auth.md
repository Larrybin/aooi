# Auth Module

## What This Module Does

Auth covers the mainline account lifecycle:

- email/password sign-up and sign-in
- password reset flow
- optional Google / GitHub social auth
- the supporting email tab used by auth-related email delivery

Detailed contract and runtime behavior live in [Authentication Guide](../auth.md).

## Required Configuration

- `email_auth_enabled`
- `google_auth_enabled`
- `google_one_tap_enabled`
- `google_client_id`
- `google_client_secret`
- `github_auth_enabled`
- `github_client_id`
- `github_client_secret`
- `resend_api_key`
- `resend_sender_email`

## External Services

- Better Auth
- Google OAuth
- GitHub OAuth
- Resend

## Minimum Verification Commands

- `pnpm test:auth-spike`
- `pnpm test:cf-local-smoke`
- `pnpm test:cf-app-smoke`

## Common Failure Modes

- OAuth provider config exists but callback origin is wrong.
- Email auth works locally but password-reset delivery fails because Resend is missing.
- Social auth buttons render, but provider-specific OAuth setup still depends on correct callback registration and environment parity.

## Product Impact If Disabled

You lose the default account lifecycle, which breaks the promised mainline sellable path.
