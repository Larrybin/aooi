'use client';

import { Link } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Separator } from '@/shared/components/ui/separator';
import { useSidebar } from '@/shared/components/ui/sidebar';
import { useAppContext } from '@/shared/contexts/app';
import { isConfigTrue } from '@/shared/lib/general-ui.client';
import { NavItem } from '@/shared/types/blocks/common';
import { SidebarFooter as SidebarFooterType } from '@/shared/types/blocks/dashboard';

import { GeneralSocialLinks, LocaleSelector, ThemeToggler } from '../common';

export function SidebarFooter({ footer }: { footer: SidebarFooterType }) {
  const { open } = useSidebar();
  const { configs } = useAppContext();
  const showTheme = Boolean(
    footer.show_theme && isConfigTrue(configs, 'general_theme_toggle_enabled')
  );
  const showLocale = Boolean(footer.show_locale);

  return (
    <>
      {open ? (
        <div className="mx-auto flex w-full items-center justify-start gap-x-4 border-t px-4 py-3">
          {footer.nav?.items
            ?.filter((item) => Boolean(item.url))
            .map((item: NavItem, idx: number) => (
              <div className="hover:text-primary cursor-pointer" key={idx}>
                <Link href={item.url || ''} target={item.target || '_self'}>
                  {item.icon && (
                    <SmartIcon
                      name={item.icon as string}
                      className="text-md"
                      size={20}
                    />
                  )}
                </Link>
              </div>
            ))}

          <GeneralSocialLinks
            className="flex items-center gap-x-4"
            itemClassName="hover:text-primary cursor-pointer"
            iconClassName="text-md"
            iconSize={20}
          />

          <div className="flex-1"></div>

          {(showTheme || showLocale) && (
            <Separator orientation="vertical" className="h-4" />
          )}
          {showTheme && <ThemeToggler />}
          {showLocale && <LocaleSelector />}
        </div>
      ) : null}
    </>
  );
}
