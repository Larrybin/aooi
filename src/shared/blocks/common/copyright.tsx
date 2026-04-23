'use client';

import { site } from '@/site';
import type { Brand as BrandType } from '@/shared/types/blocks/common';

export function Copyright({ brand }: { brand: BrandType }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="text-muted-foreground text-sm">
      © {currentYear}{' '}
      <a
        href={brand?.url || site.brand.appUrl}
        target={brand?.target || ''}
        className="text-primary hover:text-primary/80 cursor-pointer"
      >
        {brand?.title || site.brand.appName}
      </a>
      , All rights reserved
    </div>
  );
}
