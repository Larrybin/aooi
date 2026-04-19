import bundleAnalyzer from '@next/bundle-analyzer';
import { createMDX } from 'fumadocs-mdx/next';
import createNextIntlPlugin from 'next-intl/plugin';

import { NEXT_IMAGE_REMOTE_PATTERNS } from './src/shared/config/image-policy.mjs';

if (process.env.NODE_ENV === 'development') {
  import('@opennextjs/cloudflare').then((m) =>
    m.initOpenNextCloudflareForDev()
  );
}

const withMDX = createMDX();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin({
  requestConfig: './src/core/i18n/request.ts',
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
