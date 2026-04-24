import { mkdirSync } from 'node:fs';
import path from 'node:path';
import bundleAnalyzer from '@next/bundle-analyzer';
import { createMDX } from 'fumadocs-mdx/next';
import createNextIntlPlugin from 'next-intl/plugin';

import { NEXT_IMAGE_REMOTE_PATTERNS } from './src/shared/config/image-policy.mjs';

const DEFAULT_CONTENT_SITE = 'dev-local';

if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then((m) =>
    m.initOpenNextCloudflareForDev()
  );
}

const contentSiteKey = process.env.SITE?.trim() || DEFAULT_CONTENT_SITE;
const fumadocsCacheOutDir = `.cache/fumadocs/${contentSiteKey}`;
mkdirSync(path.resolve(fumadocsCacheOutDir), { recursive: true });
const withMDX = createMDX({
  outDir: fumadocsCacheOutDir,
});

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/infra/platform/i18n/request.ts',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: undefined,
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
  serverExternalPackages: ['postgres'],
  images: {
    remotePatterns: NEXT_IMAGE_REMOTE_PATTERNS,
  },
  async redirects() {
    return [];
  },
  turbopack: {
    resolveAlias: {
      // fs: {
      //   browser: './empty.ts', // We recommend to fix code imports before using this method
      // },
    },
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
    mdxRs: true,
  },
  reactCompiler: false,
};

export default withBundleAnalyzer(withNextIntl(withMDX(nextConfig)));
