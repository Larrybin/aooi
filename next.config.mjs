import bundleAnalyzer from '@next/bundle-analyzer';
import { createMDX } from 'fumadocs-mdx/next';
import createNextIntlPlugin from 'next-intl/plugin';

if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
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
  images: {
    unoptimized: true,
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
    // Disable mdxRs for Vercel deployment compatibility with fumadocs-mdx
    ...(process.env.VERCEL ? {} : { mdxRs: true }),
  },
  reactCompiler: false,
};

export default withBundleAnalyzer(withNextIntl(withMDX(nextConfig)));
