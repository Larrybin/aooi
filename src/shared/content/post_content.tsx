import 'server-only';

import { createElement, type ElementType, type ReactNode } from 'react';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { pagesSource, postsSource } from '@/core/docs/source';
import { generateTOC } from '@/core/docs/toc';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/lib/brand-placeholders.server';
import { replaceBrandPlaceholdersInReactNode } from '@/shared/lib/brand-placeholders-react.server';
import { formatPostDate } from '@/shared/lib/post-date';
import { getAllConfigs } from '@/shared/models/config';
import type {
  Category as BlogCategoryType,
  Post as BlogPostType,
} from '@/shared/types/blocks/blog';

/**
 * Content pipeline for local posts/pages and markdown-derived artifacts.
 *
 * Why this lives under `src/shared/content/**` (instead of `shared/models/**`):
 * - It is allowed to depend on docs/mdx modules (`@/core/docs/**`, `@/mdx-components`)
 * - `shared/models/**` is intentionally restricted to avoid docs/mdx coupling
 */
type LocalPostFrontmatter = {
  created_at?: string;
  author_name?: string;
  author_image?: string;
  image?: string;
};

export async function getLocalPost({
  slug,
  locale,
  postPrefix = '/blog/',
}: {
  slug: string;
  locale: string;
  postPrefix?: string;
}): Promise<BlogPostType | null> {
  const localPost = await postsSource.getPage([slug], locale);
  if (!localPost) {
    return null;
  }

  const configs = await getAllConfigs();
  const brand = buildBrandPlaceholderValues(configs);

  const MDXContent = localPost.data.body;
  const mdxComponents = getMDXComponents({
    a: createRelativeLink(postsSource, localPost),
  });
  const body = replaceBrandPlaceholdersInReactNode(
    typeof MDXContent === 'function'
      ? (MDXContent as (props: { components: unknown }) => ReactNode)({
          components: mdxComponents,
        })
      : (createElement(MDXContent as ElementType<{ components: unknown }>, {
          components: mdxComponents,
        }) as ReactNode),
    brand
  );

  const frontmatter = localPost.data as LocalPostFrontmatter;

  return {
    id: localPost.path,
    slug,
    title: replaceBrandPlaceholders(localPost.data.title || '', brand),
    description: replaceBrandPlaceholders(
      localPost.data.description || '',
      brand
    ),
    content: '',
    body,
    toc: localPost.data.toc,
    created_at: frontmatter.created_at
      ? formatPostDate(frontmatter.created_at, locale)
      : '',
    author_name: frontmatter.author_name || '',
    author_image: frontmatter.author_image || '',
    author_role: '',
    url: `${postPrefix}${slug}`,
  };
}

export async function getLocalPage({
  slug,
  locale,
  pagePrefix = '/',
}: {
  slug: string;
  locale: string;
  pagePrefix?: string;
}): Promise<BlogPostType | null> {
  const localPage = await pagesSource.getPage([slug], locale);
  if (!localPage) {
    return null;
  }

  const configs = await getAllConfigs();
  const brand = buildBrandPlaceholderValues(configs);

  const MDXContent = localPage.data.body;
  const mdxComponents = getMDXComponents({
    a: createRelativeLink(pagesSource, localPage),
  });
  const body = replaceBrandPlaceholdersInReactNode(
    typeof MDXContent === 'function'
      ? (MDXContent as (props: { components: unknown }) => ReactNode)({
          components: mdxComponents,
        })
      : (createElement(MDXContent as ElementType<{ components: unknown }>, {
          components: mdxComponents,
        }) as ReactNode),
    brand
  );

  const frontmatter = localPage.data as LocalPostFrontmatter;

  return {
    id: localPage.path,
    slug,
    title: replaceBrandPlaceholders(localPage.data.title || '', brand),
    description: replaceBrandPlaceholders(
      localPage.data.description || '',
      brand
    ),
    content: '',
    body,
    toc: localPage.data.toc,
    created_at: frontmatter.created_at
      ? formatPostDate(frontmatter.created_at, locale)
      : '',
    author_name: '',
    author_image: '',
    author_role: '',
    url: `${pagePrefix}${slug}`,
  };
}

export async function getLocalPostsAndCategories({
  locale,
  postPrefix = '/blog/',
}: {
  locale: string;
  postPrefix?: string;
  categoryPrefix?: string;
}) {
  const localPosts = postsSource.getPages(locale);

  if (!localPosts || localPosts.length === 0) {
    return {
      posts: [],
      postsCount: 0,
      categories: [],
      categoriesCount: 0,
    };
  }

  const configs = await getAllConfigs();
  const brand = buildBrandPlaceholderValues(configs);

  const posts = localPosts.map((post) => {
    const frontmatter = post.data as LocalPostFrontmatter;
    const slug = getPostSlugFromUrl({
      url: post.url,
      locale,
      prefix: postPrefix,
    });

    return {
      id: post.path,
      slug,
      title: replaceBrandPlaceholders(post.data.title || '', brand),
      description: replaceBrandPlaceholders(post.data.description || '', brand),
      author_name: frontmatter.author_name || '',
      author_image: frontmatter.author_image || '',
      created_at: frontmatter.created_at
        ? formatPostDate(frontmatter.created_at, locale)
        : '',
      image: frontmatter.image || '',
      url: `${postPrefix}${slug}`,
    } satisfies BlogPostType;
  });

  // NOTE: local categories are not currently implemented; keep the existing behavior.
  const categories: BlogCategoryType[] = [];

  return {
    posts,
    postsCount: posts.length,
    categories,
    categoriesCount: categories.length,
  };
}

export function buildPostTocFromMarkdown(content: string) {
  return generateTOC(content);
}

/**
 * @deprecated Prefer `buildPostTocFromMarkdown`.
 * Kept as a compatibility alias for internal callers.
 */
export const generatePostTocFromMarkdown = buildPostTocFromMarkdown;

function getPostSlugFromUrl({
  url,
  locale,
  prefix = '/blog/',
}: {
  url: string;
  locale: string;
  prefix?: string;
}): string {
  if (url.startsWith(prefix)) {
    return url.replace(prefix, '');
  } else if (url.startsWith(`/${locale}${prefix}`)) {
    return url.replace(`/${locale}${prefix}`, '');
  }

  return url;
}
