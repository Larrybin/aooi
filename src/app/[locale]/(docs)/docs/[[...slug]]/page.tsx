import { createElement, type ElementType, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';

import { source } from '@/core/docs/source';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/shared/lib/brand-placeholders.server';
import { replaceBrandPlaceholdersInReactNode } from '@/shared/lib/brand-placeholders-react.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export default async function DocsContentPage(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug, params.locale);

  if (!page) notFound();

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  const MDXContent = page.data.body;
  const mdxComponents = getMDXComponents({
    // this allows you to link to other pages with relative file paths
    a: createRelativeLink(source, page),
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

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
      }}
    >
      <DocsTitle>
        {replaceBrandPlaceholders(page.data.title || '', brand)}
      </DocsTitle>
      <DocsDescription>
        {replaceBrandPlaceholders(page.data.description || '', brand)}
      </DocsDescription>
      <DocsBody>{body}</DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams('slug', 'locale');
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug, params.locale);
  if (!page) notFound();

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  return {
    title: replaceBrandPlaceholders(page.data.title || '', brand),
    description: replaceBrandPlaceholders(page.data.description || '', brand),
  };
}
