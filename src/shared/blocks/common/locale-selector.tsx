'use client';

import { usePathname, useRouter } from '@/infra/platform/i18n/navigation';
import { Check, Globe, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { localeNames, locales, type Locale } from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cacheSet } from '@/shared/lib/cache';

export function LocaleSelector({
  type = 'icon',
}: {
  type?: 'icon' | 'button';
}) {
  const currentLocale = useLocale();
  const t = useTranslations('common.locale_switcher');
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitchLanguage = (value: string) => {
    if (!locales.includes(value as Locale)) {
      return;
    }
    if (value !== currentLocale) {
      // Update localStorage to sync with locale detector
      cacheSet('locale', value);
      router.push(pathname, {
        locale: value,
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {type === 'icon' ? (
          <Button
            aria-label={t('aria_label')}
            type="button"
            variant="ghost"
            size="icon"
            className="h-auto w-auto p-0"
          >
            <Languages size={18} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hover:bg-primary/10"
          >
            <Globe size={16} />
            {localeNames[currentLocale as Locale]}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleSwitchLanguage(locale)}
          >
            <span>{localeNames[locale]}</span>
            {locale === (currentLocale as Locale) && (
              <Check size={16} className="text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
