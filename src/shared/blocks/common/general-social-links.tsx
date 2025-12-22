'use client';

import { useMemo } from 'react';

import { Link } from '@/core/i18n/navigation';
import { useAppContext } from '@/shared/contexts/app';
import {
  isConfigTrue,
  parseGeneralSocialLinks,
} from '@/shared/lib/general-ui.client';

import { SmartIcon } from './smart-icon';

export function GeneralSocialLinks({
  className = 'flex min-w-0 flex-wrap items-center gap-2',
  itemClassName = 'text-muted-foreground hover:text-primary bg-background block cursor-pointer rounded-full p-2 duration-150',
  iconClassName,
  iconSize = 20,
  configs: configsProp,
}: {
  className?: string;
  itemClassName?: string;
  iconClassName?: string;
  iconSize?: number;
  configs?: Record<string, string>;
}) {
  const { configs: contextConfigs } = useAppContext();
  const configs = configsProp ?? contextConfigs;
  const generalSocialLinks = configs['general_social_links'] ?? '';
  const items = useMemo(
    () => parseGeneralSocialLinks(generalSocialLinks),
    [generalSocialLinks]
  );

  if (!isConfigTrue(configs, 'general_social_links_enabled')) {
    return null;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <Link
          key={`${item.icon}-${item.url}-${index}`}
          href={item.url || ''}
          target={item.target || '_blank'}
          className={itemClassName}
        >
          {item.icon && (
            <SmartIcon
              name={item.icon as string}
              size={iconSize}
              className={iconClassName}
            />
          )}
        </Link>
      ))}
    </div>
  );
}
