// data: blog post (content + db) + i18n (next-intl) + notFound() for missing slugs
// cache: static (generateStaticParams) + default RSC
// reason: public content page; keep SEO metadata aligned with content source
import { notFound } from 'next/navigation';
import {
  getBlogPost,
  getPublicBlogPostStaticSlugs,
} from '@/domains/content/application/public-content.query';
import { MarkdownContent } from '@/domains/content/ui/markdown-content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { locales } from '@/config/locale';
import { getLocaleSlugStaticParams } from '@/core/i18n/static-params';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import {
  buildCanonicalUrlWithAppUrl,
  buildLanguageAlternatesWithAppUrl,
} from '@/shared/lib/seo';
import BlogDetailPageView from '@/themes/default/pages/blog-detail';

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

export async function generateStaticParams() {
  return getLocaleSlugStaticParams(locales, await getPublicBlogPostStaticSlugs());
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

  return <BlogDetailPageView locale={locale} post={postWithBody} />;
}
