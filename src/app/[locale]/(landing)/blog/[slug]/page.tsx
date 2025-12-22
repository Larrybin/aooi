import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { MarkdownContent } from '@/shared/blocks/common/markdown-content';
import { buildCanonicalUrl, buildLanguageAlternates } from '@/shared/lib/seo';
import { getPost } from '@/shared/models/post';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog.metadata');
  const canonicalPath = `/blog/${slug}`;
  const canonicalUrl = buildCanonicalUrl(canonicalPath, locale);
  const languageAlternates = buildLanguageAlternates(canonicalPath);

  const post = await getPost({ slug, locale });
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
  const post = await getPost({ slug, locale });

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
