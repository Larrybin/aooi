// data: category taxonomy (db) + posts list (db) + i18n (next-intl)
// cache: static (generateStaticParams) + default RSC
// reason: public category listing should be statically prerenderable
import { notFound } from 'next/navigation';
import {
  getBlogCategory,
  getBlogCategoryPostsAndCategories,
  getPublicBlogCategoryStaticSlugs,
} from '@/domains/content/application/public-content.query';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { locales } from '@/config/locale';
import { getLocaleSlugStaticParams } from '@/core/i18n/static-params';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';
import {
  buildCanonicalUrlWithAppUrl,
  buildLanguageAlternatesWithAppUrl,
} from '@/shared/lib/seo';
import type {
  Blog as BlogType,
  Category as CategoryType,
} from '@/shared/types/blocks/blog';
import BlogPageView from '@/themes/default/pages/blog';

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

export async function generateStaticParams() {
  return getLocaleSlugStaticParams(
    locales,
    await getPublicBlogCategoryStaticSlugs()
  );
}

export default async function CategoryBlogPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // load blog data
  const t = await getTranslations('blog');

  const categoryBlog = await getBlogCategoryPostsAndCategories({
    slug,
    locale,
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

  return <BlogPageView locale={locale} blog={blog} />;
}
