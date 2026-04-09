# Docs + Blog Modules

## What These Modules Do

Docs and Blog are optional content modules:

- docs site routes under `/docs`
- blog/post routes under `/blog`
- local content pipeline and search/indexing glue

## Required Configuration

- `general_docs_enabled`
- `general_blog_enabled`

## External Services

- none required by default

## Minimum Verification Commands

- `pnpm test`
- `pnpm test:cf-app-smoke`

## Common Failure Modes

- The route exists but the public config toggle is out of sync.
- The `content` tab says the module is enabled, but public config or deploy state still hides the route.
- A deploy contract change breaks docs visibility while the module remains marked enabled.

## Product Impact If Disabled

The template keeps the sellable shell, but docs/blog routes should disappear cleanly from public navigation.
