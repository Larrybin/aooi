// data: blog translations + posts/categories (content + db)
// cache: static (generateStaticParams) + default RSC
// reason: public blog listing should be statically prerenderable
import { getBlogPostsAndCategories } from '@/features/docs/server/content';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { locales } from '@/config/locale';
import { getLocaleStaticParams } from '@/core/i18n/static-params';
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
import BlogPageView from '@/themes/default/pages/blog';

export const generateMetadata = getMetadata({
  metadataKey: 'blog.metadata',
  canonicalUrl: '/blog',
});

export function generateStaticParams() {
  return getLocaleStaticParams(locales);
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
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
    const { posts: allPosts, categories: allCategories } =
      await getBlogPostsAndCategories({
        locale,
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

  return <BlogPageView locale={locale} blog={blog} />;
}
