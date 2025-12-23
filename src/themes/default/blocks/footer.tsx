import { Link } from '@/core/i18n/navigation';
import {
  BrandLogo,
  Copyright,
  GeneralSocialLinks,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { filterLandingNavItems } from '@/shared/lib/landing-visibility';
import type { Configs } from '@/shared/models/config';
import type { NavItem } from '@/shared/types/blocks/common';
import type { Footer as FooterType } from '@/shared/types/blocks/landing';

export function Footer({
  footer,
  publicConfigs,
}: {
  footer: FooterType;
  publicConfigs?: Configs;
}) {
  const navItems = filterLandingNavItems(footer.nav?.items, publicConfigs);

  return (
    <footer
      id={footer.id}
      className={`py-8 sm:py-8 ${footer.className || ''} overflow-x-hidden`}
      // overflow-x-hidden防止-footer-撑出水平滚动条
    >
      <div className="container space-y-8 overflow-x-hidden">
        <div className="grid min-w-0 gap-12 md:grid-cols-5">
          <div className="min-w-0 space-y-4 break-words md:col-span-2 md:space-y-6">
            {footer.brand ? <BrandLogo brand={footer.brand} /> : null}

            {footer.brand?.description ? (
              <p
                className="text-muted-foreground text-sm text-balance break-words"
                dangerouslySetInnerHTML={{ __html: footer.brand.description }}
              />
            ) : null}
          </div>

          <div className="col-span-3 grid min-w-0 gap-6 sm:grid-cols-3">
            {navItems.map((item, idx) => (
              <div key={idx} className="min-w-0 space-y-4 text-sm break-words">
                <span className="block font-medium break-words">
                  {item.title}
                </span>

                <div className="flex min-w-0 flex-wrap gap-4 sm:flex-col">
                  {item.children?.map((subItem, iidx) => (
                    <Link
                      key={iidx}
                      href={subItem.url || ''}
                      target={subItem.target || ''}
                      className="text-muted-foreground hover:text-primary block break-words duration-150"
                    >
                      <span className="break-words">{subItem.title || ''}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-8">
          <div className="min-w-0 flex-1" />
          <ThemeToggler type="toggle" configs={publicConfigs} />
          {footer.show_locale !== false ? (
            <LocaleSelector type="button" />
          ) : null}
        </div>

        <div
          aria-hidden
          className="h-px min-w-0 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)] bg-[length:6px_1px] bg-repeat-x opacity-25"
        />
        <div className="flex min-w-0 flex-wrap justify-between gap-8">
          {footer.copyright ? (
            <p
              className="text-muted-foreground text-sm text-balance break-words"
              dangerouslySetInnerHTML={{ __html: footer.copyright }}
            />
          ) : footer.brand ? (
            <Copyright brand={footer.brand} />
          ) : null}

          <div className="min-w-0 flex-1"></div>

          {footer.agreement ? (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              {footer.agreement?.items.map((item: NavItem, index: number) => (
                <Link
                  key={index}
                  href={item.url || ''}
                  target={item.target || ''}
                  className="text-muted-foreground hover:text-primary block text-xs break-words underline duration-150"
                >
                  {item.title || ''}
                </Link>
              ))}
            </div>
          ) : null}

          <GeneralSocialLinks configs={publicConfigs} />
        </div>
      </div>
    </footer>
  );
}
