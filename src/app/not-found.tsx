import Link from 'next/link';
import { buildBrandPlaceholderValues } from '@/infra/platform/brand/placeholders.server';

import { AppImage } from '@/shared/blocks/common/app-image';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Button } from '@/shared/components/ui/button';

export default async function NotFoundPage() {
  const brand = buildBrandPlaceholderValues();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <AppImage src={brand.appLogo} alt="Logo" width={80} height={80} />
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
