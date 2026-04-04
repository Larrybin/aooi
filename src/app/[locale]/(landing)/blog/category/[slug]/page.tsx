// data: category taxonomy (db) + posts list (db) + i18n (next-intl) + pagination (query)
// cache: dynamic (request-based searchParams); no explicit cache for db reads
// reason: public listing varies by category/page; avoid serving stale mixed pagination data
import { notFound } from 'next/navigation';
import {
  getBlogCategory,
  getBlogCategoryPostsAndCategories,
} from '@/features/docs/server/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import {
  buildCanonicalUrlWithAppUrl,
  buildLanguageAlternatesWithAppUrl,
} from '@/shared/lib/seo';
import type {
  Blog as BlogType,
  Category as CategoryType,
} from '@/shared/types/blocks/blog';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('blog.metadata');
  const category = await getBlogCategory({ slug });
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);
  const canonicalPath = `/blog/category/${slug}`;
  const canonicalUrl = buildCanonicalUrlWithAppUrl(
    canonicalPath,
    locale,
    brand.appUrl
  );
  const languageAlternates = buildLanguageAlternatesWithAppUrl(
    canonicalPath,
    brand.appUrl
  );

  return {
    title: `${category?.title || slug} | ${t('title')}`,
    description: t('description'),
    alternates: {
      canonical: canonicalUrl,
      ...(languageAlternates ? { languages: languageAlternates } : {}),
    },
  };
}

export default async function CategoryBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
  }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // load blog data
  const t = await getTranslations('blog');
  const { page, pageSize } = await searchParams;

  const categoryBlog = await getBlogCategoryPostsAndCategories({
    slug,
    locale,
    page,
    pageSize,
  });

  if (!categoryBlog) {
    notFound();
  }

  const categories: CategoryType[] = [...categoryBlog.categories];
  categories.unshift({
    id: 'all',
    slug: 'all',
    title: t('page.all'),
    url: `/blog`,
  });

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  // build blog
  const blog: BlogType = {
    ...replaceBrandPlaceholdersDeep(t.raw('blog'), brand),
    categories,
    currentCategory: categoryBlog.currentCategory,
    posts: categoryBlog.posts,
  };

  // load page component
  const Page = await getThemePage('blog');

  return <Page locale={locale} blog={blog} />;
}
