import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import type { MDXComponents } from 'mdx/types';

import type { BrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

export function buildBrandMdxComponents(
  brand: BrandPlaceholderValues
): MDXComponents {
  const AppName = () => brand.appName;
  const AppUrl = () => brand.appUrl;
  const AppDomain = () => brand.domain;
  const SupportEmail = () => brand.supportEmail;

  const SupportEmailLink = ({ children }: PropsWithChildren) => {
    const email = brand.supportEmail;
    if (!email) {
      return children ?? null;
    }
    return (
      <a href={`mailto:${email}`} rel="nofollow noopener noreferrer">
        {children ?? email}
      </a>
    );
  };

  const AppLink = ({
    path,
    href,
    children,
    ...props
  }: PropsWithChildren<
    { path?: string; href?: string } & AnchorHTMLAttributes<HTMLAnchorElement>
  >) => {
    const resolvedHref = href
      ? href
      : brand.appUrl
        ? `${brand.appUrl}${normalizePath(path || '/')}`
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
