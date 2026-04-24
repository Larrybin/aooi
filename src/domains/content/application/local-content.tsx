import 'server-only';

import { createElement, type ElementType, type ReactNode } from 'react';
import { formatPostDate } from '@/domains/content/domain/post-date';
import { generateTOC } from '@/domains/content/domain/toc';
import {
  pagesI18n,
  pagesSource,
  postsI18n,
  postsSource,
} from '@/domains/content/infra/source';
import { replaceBrandPlaceholdersInReactNode } from '@/infra/platform/brand/placeholders-react.server';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/infra/platform/brand/placeholders.server';
import { createRelativeLink, getMDXComponents } from '@/mdx-components';

import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

import { toSortTimestamp, type BlogPostEntry } from './blog-feed';

function resolveContentLocale(locale: string, languages: string[]) {
  return languages.includes(locale) ? locale : 'en';
}

/**
 * Docs/blog 本地内容流水线。
 *
 * 这里允许依赖 docs/mdx 体系，因此归属 `features/docs/server/content/**`，
 * 而不是继续放在 shared/models 这类通用层。
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
  const sourceLocale = resolveContentLocale(locale, postsI18n.languages);
  const localPost =
    (await postsSource.getPage([slug], sourceLocale)) ??
    (sourceLocale !== postsI18n.defaultLanguage
      ? await postsSource.getPage([slug], postsI18n.defaultLanguage)
      : null);
  if (!localPost) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();

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
  const sourceLocale = resolveContentLocale(locale, pagesI18n.languages);
  const localPage =
    (await pagesSource.getPage([slug], sourceLocale)) ??
    (sourceLocale !== pagesI18n.defaultLanguage
      ? await pagesSource.getPage([slug], pagesI18n.defaultLanguage)
      : null);
  if (!localPage) {
    return null;
  }

  const brand = buildBrandPlaceholderValues();

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

export async function getLocalBlogPostEntries({
  locale,
  postPrefix = '/blog/',
}: {
  locale: string;
  postPrefix?: string;
}) {
  const requestedLocale = locale;
  const sourceLocale = resolveContentLocale(locale, postsI18n.languages);
  let contentLocale = sourceLocale;
  let localPosts = postsSource.getPages(sourceLocale);

  if (
    (!localPosts || localPosts.length === 0) &&
    sourceLocale !== postsI18n.defaultLanguage
  ) {
    contentLocale = postsI18n.defaultLanguage;
    localPosts = postsSource.getPages(postsI18n.defaultLanguage);
  }

  if (!localPosts || localPosts.length === 0) {
    return [] satisfies BlogPostEntry[];
  }

  const brand = buildBrandPlaceholderValues();

  return localPosts.map((post) => {
    const frontmatter = post.data as LocalPostFrontmatter;
    const slug = getPostSlugFromUrl({
      url: post.url,
      locale: contentLocale,
      prefix: postPrefix,
    });
    const rawCreatedAt = frontmatter.created_at || '';

    return {
      post: {
        id: post.path,
        slug,
        title: replaceBrandPlaceholders(post.data.title || '', brand),
        description: replaceBrandPlaceholders(
          post.data.description || '',
          brand
        ),
        author_name: frontmatter.author_name || '',
        author_image: frontmatter.author_image || '',
        created_at: rawCreatedAt
          ? formatPostDate(rawCreatedAt, requestedLocale)
          : '',
        image: frontmatter.image || '',
        url: `${postPrefix}${slug}`,
      } satisfies BlogPostType,
      sortTimestamp: toSortTimestamp(rawCreatedAt),
    } satisfies BlogPostEntry;
  });
}

export function buildPostTocFromMarkdown(content: string) {
  return generateTOC(content);
}

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
