import Link from 'next/link';

import { defaultLocale } from '@/config/locale';
import { LazyImage } from '@/shared/blocks/common';
import type { Configs } from '@/shared/models/config';
import type { Header as HeaderType } from '@/shared/types/blocks/landing';

import { Header as FullHeader } from './header';

function withLocale(href: string, locale: string) {
  if (!href) return href;
  if (href.startsWith('http')) return href;
  if (!href.startsWith('/')) return href;
  if (!locale || locale === defaultLocale) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
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
  const hasNestedNavItems = header.nav?.items?.some(
    (item) => (item.children?.length ?? 0) > 0
  );

  if (hasNestedNavItems) {
    return <FullHeader header={header} publicConfigs={publicConfigs} />;
  }

  return (
    <header
      id={header.id}
      className={`bg-background/75 sticky top-0 z-50 border-b backdrop-blur ${header.className || ''}`}
    >
      <div className="container flex items-center justify-between gap-4 py-4">
        {header.brand?.url ? (
          <Link
            href={withLocale(header.brand.url, locale)}
            target={header.brand.target || '_self'}
            className={`flex items-center gap-2 ${header.brand.className || ''}`}
          >
            {header.brand.logo ? (
              <LazyImage
                src={header.brand.logo.src}
                alt={
                  header.brand.logo.alt || header.brand.title || 'Brand logo'
                }
                width={40}
                height={40}
                sizes="40px"
                className="h-10 w-10"
              />
            ) : null}
            {header.brand.title ? (
              <span className="text-base font-medium">
                {header.brand.title}
              </span>
            ) : null}
          </Link>
        ) : null}

        <nav className="hidden items-center gap-6 md:flex">
          {header.nav?.items?.map((item, idx) => {
            const url = item.url || item.children?.[0]?.url || '';
            if (!url) return null;
            return (
              <Link
                key={idx}
                href={withLocale(url, locale)}
                target={item.target || '_self'}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                {item.title || item.name || ''}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {header.buttons?.map((button, idx) => (
            <Link
              key={idx}
              href={withLocale(button.url || '', locale)}
              target={button.target || '_self'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
            >
              {button.title || ''}
            </Link>
          ))}

          {header.show_sign ? (
            <Link
              href={withLocale('/sign-in', locale)}
              className="text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              Sign in
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
