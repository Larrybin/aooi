import React from 'react';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

import { envConfigs } from '@/config';
import {
  getDefaultSupportEmailFromOrigin,
  getDomainFromOrigin,
} from '@/shared/lib/support-email';

// Custom link component with nofollow for external links
const CustomLink = ({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  // Check if the link is external
  const isExternal = href?.startsWith('http') || href?.startsWith('//');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="nofollow noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }

  // Internal links
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

// Higher-order component to wrap any link component with nofollow logic
export function withNoFollow(
  LinkComponent: React.ComponentType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >
) {
  const LinkWithNoFollow = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Check if the link is external
    const isExternal = href?.startsWith('http') || href?.startsWith('//');

    if (isExternal) {
      // For external links, add nofollow and pass through to the wrapped component
      return (
        <LinkComponent
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          {...props}
        >
          {children}
        </LinkComponent>
      );
    }

    // For internal links, just use the wrapped component as-is
    return (
      <LinkComponent href={href} {...props}>
        {children}
      </LinkComponent>
    );
  };

  return LinkWithNoFollow;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function buildDefaultBrandMdxComponents(): MDXComponents {
  const appName = envConfigs.app_name || '';
  const appUrl = envConfigs.app_url || '';
  const domain = getDomainFromOrigin(appUrl);
  const supportEmail = getDefaultSupportEmailFromOrigin(appUrl);

  const AppName = () => appName;
  const AppUrl = () => appUrl;
  const AppDomain = () => domain;
  const SupportEmail = () => supportEmail;

  const SupportEmailLink = ({
    children,
  }: React.PropsWithChildren<Record<string, never>>) => (
    <a href={`mailto:${supportEmail}`} rel="nofollow noopener noreferrer">
      {children ?? supportEmail}
    </a>
  );

  const AppLink = ({
    path,
    href,
    children,
    ...props
  }: React.PropsWithChildren<
    {
      path?: string;
      href?: string;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>
  >) => {
    const resolvedHref = href
      ? href
      : appUrl
        ? `${appUrl}${normalizePath(path || '/')}`
        : normalizePath(path || '/');

    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    );
  };

  return {
    AppName,
    AppUrl,
    AppDomain,
    SupportEmail,
    SupportEmailLink,
    AppLink,
  };
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  const defaultBrandComponents = buildDefaultBrandMdxComponents();
  const mergedComponents = {
    ...defaultMdxComponents,
    a: CustomLink,
    ...defaultBrandComponents,
    ...components,
  };

  // If a custom 'a' component is provided, wrap it with nofollow logic
  if (components?.a && components.a !== CustomLink) {
    mergedComponents.a = withNoFollow(
      components.a as React.ComponentType<
        React.AnchorHTMLAttributes<HTMLAnchorElement>
      >
    );
  }

  return mergedComponents;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...buildDefaultBrandMdxComponents(),
    ...components,
  };
}
