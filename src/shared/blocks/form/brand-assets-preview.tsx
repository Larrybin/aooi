'use client';

import { useTranslations } from 'next-intl';

import { getBrandPreviewHost } from '@/shared/lib/brand-url';
import { cn } from '@/shared/lib/utils';

type BrandAssetsPreviewProps = {
  appName: string;
  appUrl: string;
  appLogo: string;
  appFavicon: string;
  appPreviewImage: string;
};

function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'bg-muted text-muted-foreground flex items-center justify-center rounded-md border border-dashed text-xs',
          className
        )}
      >
        {alt}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn('rounded-md object-cover', className)}
    />
  );
}

export function BrandAssetsPreview({
  appName,
  appUrl,
  appLogo,
  appFavicon,
  appPreviewImage,
}: BrandAssetsPreviewProps) {
  const t = useTranslations('admin.settings.brand_preview');

  const name = appName.trim() || 'YourAppName';
  const url = appUrl.trim() || 'https://your-domain.com';
  const previewHost = getBrandPreviewHost(url);

  return (
    <div className="border-border bg-muted/20 mt-8 space-y-6 rounded-xl border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        <p className="text-muted-foreground text-xs">{t('description')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4">
          <div className="border-border bg-background overflow-hidden rounded-xl border">
            <div className="border-border flex items-center gap-3 border-b px-4 py-3">
              <PreviewImage
                src={appLogo}
                alt={t('logo.alt')}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {url}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="text-sm font-medium">
                {t('preview_card.title')}
              </div>
              <PreviewImage
                src={appPreviewImage}
                alt={t('preview.alt')}
                className="aspect-[1200/630] w-full rounded-lg border object-cover"
              />
              <div className="space-y-1">
                <div className="line-clamp-1 text-sm font-semibold">
                  {name} · {t('preview_card.headline')}
                </div>
                <div className="text-muted-foreground line-clamp-2 text-xs">
                  {t('preview_card.description')}
                </div>
                <div className="text-muted-foreground text-[11px] uppercase">
                  {previewHost}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-border bg-background rounded-xl border p-4">
            <div className="mb-3 text-sm font-medium">{t('favicon.title')}</div>
            <div className="flex items-center gap-3">
              <PreviewImage
                src={appFavicon}
                alt={t('favicon.alt')}
                className="h-8 w-8 rounded-md border object-contain"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {url}
                </div>
              </div>
            </div>
          </div>

          <div className="border-border bg-background rounded-xl border p-4">
            <div className="mb-3 text-sm font-medium">
              {t('size_guide.title')}
            </div>
            <ul className="space-y-3 text-xs">
              <li>
                <div className="font-medium">{t('size_guide.logo.title')}</div>
                <div className="text-muted-foreground">
                  {t('size_guide.logo.description')}
                </div>
              </li>
              <li>
                <div className="font-medium">
                  {t('size_guide.favicon.title')}
                </div>
                <div className="text-muted-foreground">
                  {t('size_guide.favicon.description')}
                </div>
              </li>
              <li>
                <div className="font-medium">
                  {t('size_guide.preview.title')}
                </div>
                <div className="text-muted-foreground">
                  {t('size_guide.preview.description')}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
