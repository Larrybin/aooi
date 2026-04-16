# Storage Module

## What This Module Does

Storage adds managed asset upload and retrieval paths:

- brand asset uploads
- image upload APIs
- storage-backed media URLs

## Required Configuration

- `r2_access_key`
- `r2_secret_key`
- `r2_bucket_name`
- `r2_endpoint` or `r2_account_id`
- `r2_domain`

## External Services

- Cloudflare R2

## Minimum Verification Commands

- `pnpm test:r2-upload-spike`

## Common Failure Modes

- Upload succeeds but the returned URL points at the wrong domain.
- Brand asset upload is enabled before storage credentials are configured.
- R2 endpoint/domain drift causes broken public asset URLs.

## Product Impact If Disabled

Uploads and storage-backed brand assets stop working, but the shell can still run with static assets.
