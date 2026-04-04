import { Link } from '@/core/i18n/navigation';
import type { Brand as BrandType } from '@/shared/types/blocks/common';

import { BrandImage } from './brand-image';

export function BrandLogo({ brand }: { brand: BrandType }) {
  const displayHeight = 40;
  const ratioWidth = brand.logo?.width ?? 1;
  const ratioHeight = brand.logo?.height ?? 1;
  const safeRatioHeight = ratioHeight > 0 ? ratioHeight : 1;
  const displayWidth = Math.max(
    1,
    Math.round((displayHeight * ratioWidth) / safeRatioHeight)
  );

  return (
    <Link
      href={brand.url || ''}
      target={brand.target || '_self'}
      className={`flex items-center space-x-2 ${brand.className}`}
    >
      {brand.logo && (
        <BrandImage
          src={brand.logo.src}
          alt={brand.logo.alt || brand.title || 'Brand logo'}
          width={displayWidth}
          height={displayHeight}
          className="h-10 w-auto"
        />
      )}
      {brand.title && (
        <span className="text-lg font-medium">{brand.title}</span>
      )}
    </Link>
  );
}
