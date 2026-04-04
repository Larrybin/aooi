// data: blog translations + posts/categories (content + db) + pagination (query)
// cache: dynamic (request-based searchParams); no explicit cache for db reads
// reason: public listing varies by page; avoid serving stale mixed pagination data
import { getBlogPostsAndCategories } from '@/features/docs/server/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholdersDeep,
} from '@/shared/lib/brand-placeholders.server';
import { logger } from '@/shared/lib/logger.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';
import { getMetadata } from '@/shared/lib/seo';
import type {
  Blog as BlogType,
  Category as CategoryType,
  Post as PostType,
} from '@/shared/types/blocks/blog';

export const generateMetadata = getMetadata({
  metadataKey: 'blog.metadata',
  canonicalUrl: '/blog',
});

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // load blog data
  const t = await getTranslations('blog');

  let posts: PostType[] = [];
  let categories: CategoryType[] = [];

  // current category data
  const currentCategory: CategoryType = {
    id: 'all',
    slug: 'all',
    title: t('page.all'),
    url: `/blog`,
  };

  try {
    const { page, pageSize } = await searchParams;

    const { posts: allPosts, categories: allCategories } =
      await getBlogPostsAndCategories({
        locale,
        page,
        pageSize,
      });

    posts = allPosts;
    categories = allCategories;

    categories.unshift(currentCategory);
  } catch (error) {
    logger.warn('landing: get posts failed', { route: '/blog', locale, error });
  }

  // build blog data
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  const blog: BlogType = {
    ...replaceBrandPlaceholdersDeep(t.raw('blog'), brand),
    categories,
    currentCategory,
    posts,
  };

  // load page component
  const Page = await getThemePage('blog');

  return <Page locale={locale} blog={blog} />;
}
