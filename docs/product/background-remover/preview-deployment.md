# Background Remover Preview Deployment

This runbook brings the `background-remover` site up on Cloudflare
workers.dev. Preview is not a separate site. Use the real site key with the
preview deploy profile.

```bash
SITE=background-remover
CF_DEPLOY_PROFILE=preview
```

## Required Values

Collect these before deploying:

- `CF_WORKERS_DEV_SUBDOMAIN`: the Cloudflare account workers.dev subdomain.
- `PREVIEW_DATABASE_URL`: direct PostgreSQL connection string for the preview
  database. This is used only by local Drizzle migration commands.
- `PREVIEW_HYPERDRIVE_ID`: Cloudflare Hyperdrive config ID pointing at that
  preview database. This is a 32-character lowercase hex ID, not a database
  URL.
- `STORAGE_PUBLIC_BASE_URL`: public base URL for objects in the preview storage
  bucket.

For a quick anonymous upload preview, payment and email secrets can use preview
placeholders. For OAuth, billing, or email testing, provide real preview secrets
instead.

## Cloudflare Resources

Create the preview R2 buckets:

```bash
wrangler r2 bucket create aooi-background-remover-preview-opennext-cache
wrangler r2 bucket create aooi-background-remover-preview-storage
```

Create a Cloudflare Hyperdrive config that points at the preview PostgreSQL
database, then keep the returned ID as `PREVIEW_HYPERDRIVE_ID`.

Cloudflare Images must be enabled for the account because the public-web worker
binds `IMAGES` and uses `segment=foreground`.

## Local Preview Overlay

Create the preview deploy overlay with the real Hyperdrive ID:

```bash
cat > sites/background-remover/deploy.preview.settings.json <<'JSON'
{
  "configVersion": 1,
  "resources": {
    "hyperdriveId": "replace_with_preview_hyperdrive_id"
  }
}
JSON
```

Replace `replace_with_preview_hyperdrive_id` before running checks or deploys.
Do not deploy with an all-zero or example Hyperdrive ID.

## Database Migration

Run migrations against the preview database with its direct PostgreSQL URL:

```bash
DATABASE_URL="$PREVIEW_DATABASE_URL" SITE=background-remover pnpm db:migrate
```

Cloudflare Workers will use Hyperdrive at runtime; Drizzle CLI uses
`DATABASE_URL` locally.

## Preflight

Run the preview config gate before deploying:

```bash
SITE=background-remover \
CF_WORKERS_DEV_SUBDOMAIN="$CF_WORKERS_DEV_SUBDOMAIN" \
STORAGE_PUBLIC_BASE_URL="$STORAGE_PUBLIC_BASE_URL" \
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true \
pnpm cf:preview:check
```

Run the preview build gate:

```bash
SITE=background-remover \
CF_WORKERS_DEV_SUBDOMAIN="$CF_WORKERS_DEV_SUBDOMAIN" \
STORAGE_PUBLIC_BASE_URL="$STORAGE_PUBLIC_BASE_URL" \
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true \
pnpm cf:preview:build
```

## First Deploy

Deploy state first, then bootstrap the app workers:

```bash
SITE=background-remover \
CF_WORKERS_DEV_SUBDOMAIN="$CF_WORKERS_DEV_SUBDOMAIN" \
STORAGE_PUBLIC_BASE_URL="$STORAGE_PUBLIC_BASE_URL" \
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true \
pnpm cf:preview:deploy:state
```

```bash
SITE=background-remover \
CF_WORKERS_DEV_SUBDOMAIN="$CF_WORKERS_DEV_SUBDOMAIN" \
STORAGE_PUBLIC_BASE_URL="$STORAGE_PUBLIC_BASE_URL" \
CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true \
pnpm cf:preview:bootstrap
```

The preview URL is:

```text
https://aooi-background-remover-preview-router.<CF_WORKERS_DEV_SUBDOMAIN>.workers.dev
```

## Later Updates

After the preview topology exists, deploy app updates with:

```bash
SITE=background-remover \
CF_WORKERS_DEV_SUBDOMAIN="$CF_WORKERS_DEV_SUBDOMAIN" \
STORAGE_PUBLIC_BASE_URL="$STORAGE_PUBLIC_BASE_URL" \
pnpm cf:preview:deploy
```

## Smoke Test

Open the preview URL and run the product flow:

1. Upload a PNG, JPEG, or WebP image under the current plan size limit.
2. Confirm the result preview renders with a transparent checkerboard.
3. Download the PNG.
4. Verify the downloaded PNG has an alpha channel.
5. Confirm failed transforms do not create downloadable result files or consume
   committed quota.

Local offline Images binding support is not enough for this product smoke. Use
the deployed preview runtime to verify real `segment=foreground` output.
