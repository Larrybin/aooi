# Roller Rabbit - Next.js AI SaaS Development Framework

Roller Rabbit is a comprehensive Next.js-based framework designed for rapid AI SaaS product development. Built on Next.js 16, it provides a complete development ecosystem with pre-built components, business functions, and extensive third-party integrations. The framework eliminates months of boilerplate work by offering ready-to-use systems for landing pages, user management, admin dashboards, and payment processing.

The framework follows a modular architecture with six major components: core systems (Landing, Admin, User Console), core modules (Database, Authentication, RBAC, i18n), extension modules (Payment, Storage, Email, AI, Analytics, Ads, Affiliate, Customer Service), theme system, configuration system, and content management. This pluggable architecture allows developers to quickly assemble features, customize branding, and deploy production-ready applications with minimal configuration. Roller Rabbit supports multiple deployment platforms including Vercel, Cloudflare Workers (via OpenNext), and VPS via Dokploy.

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

## Project Initialization and Local Development

Starting a new project with environment configuration

```bash
# Clone the repository
git clone git@github.com:Larrybin/aooi.git my-project
cd my-project

# Install dependencies
pnpm install

# Create environment configuration
cp .env.example .env

# Configure DATABASE_URL / secrets in .env, then run migrations
pnpm db:migrate

# Start development server
pnpm dev

# Start on custom port
pnpm dev --port 8080
```

## Database Configuration and Migration

Setting up PostgreSQL database with Drizzle ORM

```toml
# .env configuration
DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/my_project"
DATABASE_PROVIDER = "postgresql"

# Traditional server (Docker/VPS): enable pooling
DB_SINGLETON_ENABLED = "true"

# Serverless Node (Vercel/Lambda): disable pooling (max=1 cached client)
# DB_SINGLETON_ENABLED = "false"
```

Notes:

- `DATABASE_PROVIDER` currently supports `postgresql` only.
- Cloudflare Workers runtime uses Hyperdrive (`HYPERDRIVE.connectionString`) and ignores `DATABASE_URL`. Ensure `nodejs_compat` is enabled and configure it in `wrangler.toml` (see `wrangler.toml.example`).
- For details, see `docs/guides/database.md`.

```bash
# Generate and migrate database tables
pnpm db:generate
pnpm db:migrate

# Verify database connection
psql "postgresql://user:password@address:port/database"
```

## Authentication Setup with Better Auth

Configuring user authentication and admin access

```bash
# Generate authentication secret
openssl rand -base64 32
```

```toml
# .env configuration
# BETTER_AUTH_SECRET is preferred; AUTH_SECRET is supported as a fallback.
BETTER_AUTH_SECRET = "your-generated-secret-key"
# AUTH_SECRET = "your-generated-secret-key"
```

```bash
# Initialize RBAC permissions
pnpm rbac:init

# Assign super admin role to user
pnpm rbac:assign -- --email=admin@example.com --role=super_admin
```

For details, see `docs/guides/auth.md` and `docs/guides/rbac.md`.

## Google OAuth Login Integration

Enabling Google Sign-In and One-Tap Login

```bash
# Google OAuth callback URL format
https://your-domain.com/api/auth/callback/google

# Authorized JavaScript origins
https://your-domain.com
```

Configuration in Admin Dashboard at `/<locale?>/admin/settings/auth`:

- Navigate to Settings → Auth → Google Auth
- Enter Client ID and Client secret from Google Cloud Console
- Enable "Auth Enabled" for Google redirect login
- Enable "OneTap Enabled" for Google One-Tap login

## Stripe Payment Integration

Configuring Stripe for one-time payments and subscriptions

```json
{
  "pricing": {
    "items": [
      {
        "title": "Starter",
        "description": "Get started with your first SaaS startup.",
        "interval": "one-time",
        "amount": 9900,
        "currency": "USD",
        "price": "$99",
        "original_price": "$199",
        "product_id": "starter",
        "product_name": "Starter Plan",
        "credits": 100,
        "valid_days": 30,
        "group": "one-time"
      }
    ]
  }
}
```

```bash
# Create checkout session - API endpoint
# Note: this endpoint requires an authenticated user session.
POST /api/payment/checkout
Content-Type: application/json

{
  "product_id": "starter",
  "currency": "usd",
  "locale": "en",
  "payment_provider": "stripe",
  "metadata": {}
}

# Stripe webhook configuration
# Events to monitor:
# - checkout.session.completed
# - invoice.payment_succeeded
# - invoice.payment_failed
# - customer.subscription.updated
# - customer.subscription.deleted

# Webhook endpoint URL
https://your-domain.com/api/payment/notify/<provider>
```

For full checkout/callback/webhook flow and supported providers, see `docs/guides/payment.md`.

## Multi-Currency Payment Configuration

Supporting multiple currencies with automatic conversion

```json
{
  "amount": 9900,
  "currency": "usd",
  "price": "$99",
  "original_price": "$199",
  "currencies": [
    {
      "currency": "cny",
      "amount": 69900,
      "price": "¥699",
      "original_price": "¥1399"
    }
  ]
}
```

## Cloudflare R2 Storage Integration

Configuring file storage for avatars and uploads

```bash
# R2 bucket endpoint format
https://pub-xxx.r2.dev

# Custom domain format
https://r2.your-domain.com
```

Configuration in Admin Dashboard at `/<locale?>/admin/settings/storage`:

- Navigate to Settings → Storage → Cloudflare R2
- Enter Access Key ID and Secret Access Key
- Set Bucket Name and custom upload path
- Configure R2 endpoint and custom domain

```bash
# Test file upload
# Upload avatar at /settings/profile
# Verify uploaded file URL matches custom domain
```

## Resend Email Service Integration

Sending transactional emails with templates

```bash
# Test email sending
# NOTE: this endpoint requires a logged-in admin session (cookie auth) + CSRF checks.
# A plain curl without session cookies will return 401/403.
curl -X POST https://your-domain.com/api/email/test \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-domain.com" \
  -H "Cookie: <paste your session cookies here>" \
  -d '{
    "emails": ["support@example.com"],
    "subject": "Test Email"
  }'

# Expected response
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "messageId": "xxx",
    "provider": "resend"
  }
}
```

```typescript
// Send email (server-only)
import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { getEmailService } from '@/shared/services/email';

const emailService = await getEmailService();
const result = await emailService.sendEmail({
  to: ['support@example.com'],
  subject: 'Verification Code',
  ...buildVerificationCodeEmailPayload({ code: '123456' }),
});
```

## Environment Variables Configuration

Managing configuration across development and production

```typescript
// Client-safe config (usable in both Server/Client Components)
import { envConfigs } from '@/config';
// Server-only config (DO NOT import in client components)
import { serverEnv } from '@/config/server';

envConfigs.app_url;
envConfigs.app_name;
envConfigs.theme;
envConfigs.locale;

serverEnv.databaseUrl;
serverEnv.dbSingletonEnabled;
serverEnv.authBaseUrl;
serverEnv.authSecret;
```

Notes:

- `.env` is used for bootstrap settings (app URL/name/theme/locale), database connection (`DATABASE_URL`), and secrets (`BETTER_AUTH_SECRET` / `AUTH_SECRET`).
- Most third-party integration configs (payment/email/storage/analytics/etc) are stored in the config table and managed via `/<locale?>/admin/settings/<tab>` (see `docs/guides/settings.md`).
- Do not put secrets in `NEXT_PUBLIC_*` variables.

## Application Branding and Customization

Configuring app metadata and assets

```toml
# .env - Local development
NEXT_PUBLIC_APP_URL = "http://localhost:3000"
NEXT_PUBLIC_APP_NAME = "My Project"
NEXT_PUBLIC_THEME = "default"

# .env.production - Production deployment
NEXT_PUBLIC_APP_URL = "https://your-domain.com"
NEXT_PUBLIC_APP_NAME = "My SaaS Product"
```

Recommended: configure Brand via `/<locale?>/admin/settings/general` (see `README.md`).

SEO files:

- Sitemap: `src/app/sitemap.ts` (dynamic)
- Robots: `src/app/robots.ts`

## Vercel Deployment

Deploying to Vercel with custom domain and environment variables

```bash
# Set Git remote to your repository
git remote set-url origin git@github.com:your-org/your-repo.git

# Push code to GitHub
git add .
git commit -m "first version"
git push origin main
```

```toml
# .env.production for Vercel
NEXT_PUBLIC_APP_URL = "https://your-domain.com"
NEXT_PUBLIC_APP_NAME = "Your App Name"
NEXT_PUBLIC_THEME = "default"

DATABASE_URL = "postgresql://user:password@domain:port/database"
DATABASE_PROVIDER = "postgresql"
DB_SINGLETON_ENABLED = "false"

BETTER_AUTH_SECRET = "your-secret-key"
# AUTH_SECRET = "your-secret-key"
```

Configuration steps in Vercel Dashboard:

1. Import GitHub repository at vercel.com/new
2. Add custom domain in Domains section
3. Configure DNS (CNAME or A record) at domain registrar
4. Paste environment variables in Settings → Environment Variables
5. Redeploy project after configuration changes

## Admin Dashboard Configuration

Visual configuration management at `/<locale?>/admin/settings/<tab>`

Key configuration categories accessible via Admin Dashboard:

**General Settings:**

- Initial credits for new users
- App name, description, logo, preview image

**Authentication:**

- Email authentication toggle
- Google OAuth (Client ID, Client Secret, One-Tap)
- GitHub OAuth (Client ID, Client Secret)

**Payment:**

- Default payment provider selection
- Stripe (API keys, webhook secret, payment methods, promotion codes)
- PayPal (Environment, Client ID, Client Secret)

**Storage:**

- Cloudflare R2 (Access Key, Secret Key, Bucket, Endpoint, Domain)
- Custom upload path configuration

**Email:**

- Resend (API Key, Sender Email)

**AI Providers:**

- OpenRouter (API Key, Base URL)
- Replicate (API Token, custom storage)
- Fal (API Key, custom storage)
- Gemini (API Key)

**Analytics:**

- Google Analytics ID
- Microsoft Clarity ID
- Plausible (Domain, Script Source)
- OpenPanel Client ID
- Vercel Analytics toggle

**Customer Service:**

- Crisp (Website ID)
- Tawk (Property ID, Website ID)

**Affiliate Marketing:**

- Affonso (Program ID, Cookie Duration)
- PromoteKit (Program ID)

## Summary

Roller Rabbit serves as a comprehensive foundation for launching AI SaaS products, dramatically reducing time-to-market by providing production-ready implementations of common SaaS features. The framework is particularly valuable for indie developers and small teams who need to quickly validate business ideas without building infrastructure from scratch. Core use cases include AI-powered web applications, subscription-based SaaS products, content platforms with payment processing, and multi-tenant applications requiring user management and role-based access control.

The framework's integration patterns emphasize configuration over coding, with most features enabled through the admin dashboard (DB-backed configs) and a small set of bootstrap environment variables rather than custom code. The modular architecture allows selective feature adoption - developers can use only the landing page system for static sites, or progressively add authentication, payments, and AI capabilities as needed. Roller Rabbit supports multiple deployment strategies (Serverless via Vercel/Cloudflare, or traditional VPS via Dokploy) and integrates seamlessly with popular third-party services (Stripe, Supabase, Resend, Cloudflare R2). The built-in i18n system, theme customization, and content management make it suitable for global audiences and diverse branding requirements.
