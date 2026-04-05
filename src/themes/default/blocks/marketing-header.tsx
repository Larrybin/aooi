import Link from 'next/link';
import { SignUser } from '@/features/web/auth/components/sign-user';
import { ChevronDown, Menu } from 'lucide-react';

import { defaultLocale } from '@/config/locale';
import { BrandImage } from '@/shared/blocks/common';
import { filterLandingNavItems } from '@/shared/lib/landing-visibility';
import type { Configs } from '@/shared/models/config';
import type { NavItem } from '@/shared/types/blocks/common';
import type { Header as HeaderType } from '@/shared/types/blocks/landing';

function withLocale(href: string, locale: string) {
  if (!href) return href;
  if (href.startsWith('http')) return href;
  if (!href.startsWith('/')) return href;
  if (!locale || locale === defaultLocale) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

function getNavItemHref(item: NavItem, locale: string) {
  const url = item.url || item.children?.[0]?.url || '';
  return withLocale(url, locale);
}

function hasNavChildren(item: NavItem) {
  return (item.children?.length ?? 0) > 0;
}

function MarketingNavItem({ item, locale }: { item: NavItem; locale: string }) {
  const href = getNavItemHref(item, locale);
  const title = item.title || item.name || '';

  if (!hasNavChildren(item)) {
    if (!href) return null;
    return (
      <Link
        href={href}
        target={item.target || '_self'}
        prefetch={false}
        className="text-muted-foreground hover:text-foreground text-sm font-medium"
      >
        {title}
      </Link>
    );
  }

  return (
    <details className="group relative">
      <summary className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
        <span>{title}</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="bg-background absolute left-0 mt-3 w-max min-w-56 rounded-md border p-2 shadow-sm">
        {item.children?.map((child, idx) => {
          const childHref = child.url ? withLocale(child.url, locale) : '';
          if (!childHref) return null;
          return (
            <Link
              key={idx}
              href={childHref}
              target={child.target || '_self'}
              prefetch={false}
              className="hover:bg-muted block rounded px-3 py-2 text-sm"
            >
              <div className="font-medium">
                {child.title || child.name || ''}
              </div>
              {child.description ? (
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {child.description}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export function MarketingHeader({
  header,
  locale,
  publicConfigs,
}: {
  header: HeaderType;
  locale: string;
  publicConfigs?: Configs;
}) {
  const navItems = filterLandingNavItems(header.nav?.items, publicConfigs);

  return (
    <header
      id={header.id}
      className={`bg-background/88 border-border/70 sticky top-0 z-50 border-b backdrop-blur ${header.className || ''}`}
    >
      <div className="container flex items-center justify-between gap-4 py-4">
        {header.brand?.url ? (
          <Link
            href={withLocale(header.brand.url, locale)}
            target={header.brand.target || '_self'}
            prefetch={false}
            className={`flex items-center gap-2 ${header.brand.className || ''}`}
          >
            {header.brand.logo ? (
              <BrandImage
                src={header.brand.logo.src}
                alt={
                  header.brand.logo.alt || header.brand.title || 'Brand logo'
                }
                width={40}
                height={40}
                className="h-10 w-10"
              />
            ) : null}
            {header.brand.title ? (
              <span className="text-base font-semibold tracking-tight">
                {header.brand.title}
              </span>
            ) : null}
          </Link>
        ) : null}

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item, idx) => (
            <MarketingNavItem key={idx} item={item} locale={locale} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {navItems.length ? (
            <details className="relative md:hidden">
              <summary className="hover:bg-muted inline-flex cursor-pointer list-none items-center justify-center rounded-full p-2">
                <Menu className="size-5" />
                <span className="sr-only">Menu</span>
              </summary>
              <div className="bg-background absolute right-0 mt-3 w-72 rounded-md border p-2 shadow-sm">
                <nav className="space-y-1">
                  {navItems.map((item, idx) => {
                    const href = getNavItemHref(item, locale);
                    const title = item.title || item.name || '';

                    if (!hasNavChildren(item)) {
                      if (!href) return null;
                      return (
                        <Link
                          key={idx}
                          href={href}
                          target={item.target || '_self'}
                          prefetch={false}
                          className="hover:bg-muted block rounded px-3 py-2 text-sm font-medium"
                        >
                          {title}
                        </Link>
                      );
                    }

                    return (
                      <details key={idx} className="group rounded">
                        <summary className="hover:bg-muted flex cursor-pointer list-none items-center justify-between rounded px-3 py-2 text-sm font-medium">
                          <span>{title}</span>
                          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-1 space-y-1 pl-2">
                          {item.children?.map((child, cidx) => {
                            const childHref = child.url
                              ? withLocale(child.url, locale)
                              : '';
                            if (!childHref) return null;
                            return (
                              <Link
                                key={cidx}
                                href={childHref}
                                target={child.target || '_self'}
                                prefetch={false}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted block rounded px-3 py-2 text-sm"
                              >
                                {child.title || child.name || ''}
                              </Link>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </nav>
              </div>
            </details>
          ) : null}

          {header.buttons?.map((button, idx) => (
            <Link
              key={idx}
              href={withLocale(button.url || '', locale)}
              target={button.target || '_self'}
              prefetch={false}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium"
            >
              {button.title || ''}
            </Link>
          ))}

          {header.show_sign ? <SignUser userNav={header.user_nav} /> : null}
        </div>
      </div>
    </header>
  );
}
