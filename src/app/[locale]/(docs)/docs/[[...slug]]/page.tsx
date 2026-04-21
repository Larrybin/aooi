// data: docs source (fumadocs) + slug/locale params + MDX components
// cache: static (generateStaticParams) + default RSC
// reason: public docs pages; unknown slugs should return notFound()
import { createElement, type ElementType, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/mdx-components';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';

import {
  docsSource,
  listDocsStaticParams,
  readDocsPage,
} from '@/domains/content/application/docs-content.query';
import { replaceBrandPlaceholdersInReactNode } from '@/infra/platform/brand/placeholders-react.server';
import {
  buildBrandPlaceholderValues,
  replaceBrandPlaceholders,
} from '@/infra/platform/brand/placeholders.server';
import { createRelativeLink } from '@/mdx-components';
import { getPublicConfigsCached } from '@/domains/settings/application/public-config.view';

export default async function DocsContentPage(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = readDocsPage(params);

  if (!page) notFound();

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  const MDXContent = page.data.body;
  const mdxComponents = getMDXComponents({
    // this allows you to link to other pages with relative file paths
    a: createRelativeLink(docsSource, page),
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
  return listDocsStaticParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; locale?: string }>;
}) {
  const params = await props.params;
  const page = readDocsPage(params);
  if (!page) notFound();

  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  return {
    title: replaceBrandPlaceholders(page.data.title || '', brand),
    description: replaceBrandPlaceholders(page.data.description || '', brand),
  };
}
