import Link from 'next/link';

import { BrandImage } from '@/shared/blocks/common/brand-image';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';
import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import { getPublicConfigsCached } from '@/shared/lib/public-configs-cache';

export default async function NotFoundPage() {
  const publicConfigs = await getPublicConfigsCached();
  const brand = buildBrandPlaceholderValues(publicConfigs);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <BrandImage src={brand.appLogo} alt="Logo" width={80} height={80} />
      <h1 className="text-2xl font-normal">Page not found</h1>
      <Button asChild>
        <Link href="/" className="mt-4">
          <SmartIcon name="ArrowLeft" />
          <span>Back to Home</span>
        </Link>
      </Button>
    </div>
  );
}
