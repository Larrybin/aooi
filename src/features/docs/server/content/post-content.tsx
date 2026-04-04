import 'server-only';

import { createElement, type ElementType, type ReactNode } from 'react';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';

import { i18n, pagesSource, postsSource } from '@/core/docs/source';
import { replaceBrandPlaceholdersInReactNode } from '@/shared/lib/brand-placeholders-react.server';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/lib/brand-placeholders.server';
import { formatPostDate } from '@/shared/lib/post-date';
import { buildPostTocFromMarkdown as buildMarkdownToc } from '@/shared/lib/post-toc';
import { getAllConfigs } from '@/shared/models/config';
import type { Post as BlogPostType } from '@/shared/types/blocks/blog';

import { toSortTimestamp, type BlogPostEntry } from './blog-feed';

const supportedContentLocales = new Set(i18n.languages);

function resolveContentLocale(locale: string) {
  return supportedContentLocales.has(locale) ? locale : i18n.defaultLanguage;
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
  const sourceLocale = resolveContentLocale(locale);
  const localPost =
    (await postsSource.getPage([slug], sourceLocale)) ??
    (sourceLocale !== i18n.defaultLanguage
      ? await postsSource.getPage([slug], i18n.defaultLanguage)
      : null);
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
  const sourceLocale = resolveContentLocale(locale);
  const localPage =
    (await pagesSource.getPage([slug], sourceLocale)) ??
    (sourceLocale !== i18n.defaultLanguage
      ? await pagesSource.getPage([slug], i18n.defaultLanguage)
      : null);
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

export async function getLocalBlogPostEntries({
  locale,
  postPrefix = '/blog/',
}: {
  locale: string;
  postPrefix?: string;
}) {
  const requestedLocale = locale;
  const sourceLocale = resolveContentLocale(locale);
  let contentLocale = sourceLocale;
  let localPosts = postsSource.getPages(sourceLocale);

  if (
    (!localPosts || localPosts.length === 0) &&
    sourceLocale !== i18n.defaultLanguage
  ) {
    contentLocale = i18n.defaultLanguage;
    localPosts = postsSource.getPages(i18n.defaultLanguage);
  }

  if (!localPosts || localPosts.length === 0) {
    return [] satisfies BlogPostEntry[];
  }

  const configs = await getAllConfigs();
  const brand = buildBrandPlaceholderValues(configs);

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
  return buildMarkdownToc(content);
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
