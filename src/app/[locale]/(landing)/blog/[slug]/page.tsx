// data: blog post (content + db) + i18n (next-intl) + notFound() for missing slugs
// cache: default (no explicit cache; slug-based dynamic route)
// reason: public content page; keep SEO metadata aligned with content source
import { notFound } from 'next/navigation';
import { getBlogPost } from '@/features/docs/server/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { MarkdownContent } from '@/shared/blocks/common/markdown-content';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import {
  buildCanonicalUrlWithAppUrl,
  buildLanguageAlternatesWithAppUrl,
} from '@/shared/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog.metadata');
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const canonicalPath = `/blog/${slug}`;
  const canonicalUrl = buildCanonicalUrlWithAppUrl(
    canonicalPath,
    locale,
    brand.appUrl
  );
  const languageAlternates = buildLanguageAlternatesWithAppUrl(
    canonicalPath,
    brand.appUrl
  );

  const post = await getBlogPost({ slug, locale });
  if (!post) {
    return {
      title: `${slug} | ${t('title')}`,
      description: t('description'),
      alternates: {
        canonical: canonicalUrl,
        ...(languageAlternates ? { languages: languageAlternates } : {}),
      },
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${post.title} | ${t('title')}`,
    description: post.description,
    alternates: {
      canonical: canonicalUrl,
      ...(languageAlternates ? { languages: languageAlternates } : {}),
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // load blog data
  const post = await getBlogPost({ slug, locale });

  if (!post) {
    notFound();
  }

  const postWithBody =
    !post.body && post.content
      ? { ...post, body: <MarkdownContent content={post.content} /> }
      : post;

  const Page = await getThemePage('blog-detail');

  return <Page locale={locale} post={postWithBody} />;
}
