# Growth Support Modules

## What These Modules Do

Growth Support groups the optional modules that extend distribution and support rather than the mainline shell:

- Analytics
- Affiliate
- Customer Service
- Ads

## Required Configuration

- Analytics tab provider keys
- Affiliate tab provider keys
- Customer Service tab provider keys
- Ads tab provider switch, provider-specific runtime keys, and zone script sources when the active provider uses in-page placements
- supporting email config when customer service workflows depend on email delivery

## External Services

- Google Analytics
- Clarity
- Plausible
- OpenPanel
- Vercel Analytics
- Affonso
- PromoteKit
- Crisp
- Tawk
- Google AdSense
- Adsterra
- Resend

## Minimum Verification Commands

- `pnpm test`

## Common Failure Modes

- Provider config exists but there is no trustworthy acceptance evidence.
- Customer service widgets render, but supporting email config is incomplete.
- The settings tab reads like a first-class product module even though it is optional growth/support infrastructure.
- `blog_post_inline` is wired to content sources that cannot supply a splittable database-style body, so inline ads silently disappear while footer ads still render.
- `landing_inline_primary` is tied to an optional section such as `logos`, so removing that section accidentally disables the first landing ads zone.

## Product Impact If Disabled

The mainline shell still runs. You lose measurement, affiliate attribution, support widgets, and ad integrations, but not the core sellable path.
