import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { LazyImage } from '@/shared/blocks/common';
import { Button } from '@/shared/components/ui/button';
import { Hero as HeroType } from '@/shared/types/blocks/landing';

export function Hero({
  hero,
  className,
}: {
  hero: HeroType;
  className?: string;
}) {
  const highlightText = hero.highlight_text ?? '';
  let texts = null;
  if (highlightText) {
    texts = hero.title?.split(highlightText, 2);
  }

  const userImgUrls = [
    '/imgs/avatars/1.png',
    '/imgs/avatars/2.png',
    '/imgs/avatars/3.png',
    '/imgs/avatars/4.png',
    '/imgs/avatars/5.png',
    '/imgs/avatars/6.png',
  ];

  const fallbackHeroImageRatio = { width: 2434, height: 1642 };
  const heroImageAlt =
    hero.image?.alt || hero.image_invert?.alt || hero.title || 'Hero image';
  const heroImageSources = [hero.image?.src, hero.image_invert?.src].filter(
    Boolean
  );
  const shouldPrioritizeHeroImage = heroImageSources.length === 1;

  const getImageWrapperStyle = (image?: {
    width?: number;
    height?: number;
  }) => {
    const width = image?.width ?? fallbackHeroImageRatio.width;
    const height = image?.height ?? fallbackHeroImageRatio.height;
    if (!width || !height) {
      return undefined;
    }
    return { aspectRatio: `${width} / ${height}` } as const;
  };

  return (
    <>
      <section
        id={hero.id}
        className={`pt-24 pb-8 md:pt-36 md:pb-8 ${hero.className} ${className}`}
      >
        {hero.announcement && (
          <div>
            <Link
              href={hero.announcement.url || ''}
              target={hero.announcement.target || '_self'}
              className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto mb-8 flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
            >
              <span className="text-foreground text-sm">
                {hero.announcement.title}
              </span>
              <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

              <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                  <span className="flex size-6">
                    <ArrowRight className="m-auto size-3" />
                  </span>
                  <span className="flex size-6">
                    <ArrowRight className="m-auto size-3" />
                  </span>
                </div>
              </div>
            </Link>
          </div>
        )}

        <div className="relative mx-auto max-w-5xl px-4 text-center">
          {texts && texts.length > 0 ? (
            <h1 className="text-foreground text-5xl font-semibold text-balance sm:mt-12 sm:text-7xl">
              {texts[0]}
              <span className="decoration-primary underline underline-offset-4">
                {highlightText}
              </span>
              {texts[1]}
            </h1>
          ) : (
            <h1 className="text-foreground text-5xl font-semibold text-balance sm:mt-12 sm:text-7xl">
              {hero.title}
            </h1>
          )}

          <p
            className="text-muted-foreground mt-8 mb-8 text-lg text-balance"
            dangerouslySetInnerHTML={{ __html: hero.description ?? '' }}
          />

          {hero.buttons && (
            <div className="flex items-center justify-center gap-4">
              {hero.buttons.map((button, idx) => (
                <Button
                  asChild
                  size={button.size || 'default'}
                  variant={button.variant || 'default'}
                  className="px-4 text-sm"
                  key={idx}
                >
                  <Link
                    href={button.url ?? ''}
                    target={button.target ?? '_self'}
                  >
                    <span>{button.title}</span>
                  </Link>
                </Button>
              ))}
            </div>
          )}

          {hero.tip && (
            <p
              className="text-muted-foreground mt-6 block text-center text-sm"
              dangerouslySetInnerHTML={{ __html: hero.tip ?? '' }}
            />
          )}

          {hero.show_avatars && (
            <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-2 sm:flex-row">
              <span className="mx-4 inline-flex items-center -space-x-2">
                {userImgUrls.map((url, index) => (
                  <span
                    key={index}
                    className="bg-muted ring-background block size-10 overflow-hidden rounded-full ring-2"
                  >
                    <LazyImage
                      src={url}
                      alt={`User avatar ${index + 1}`}
                      width={40}
                      height={40}
                      sizes="40px"
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </span>
                ))}
              </span>
              <div className="flex flex-col items-center gap-1 md:items-start">
                <div className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground text-left text-sm font-normal">
                  {hero.avatars_tip || ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      {hero.image && (
        <section className="border-foreground/10 relative mt-8 border-y sm:mt-16">
          <div className="relative z-10 mx-auto max-w-6xl border-x px-3">
            <div className="border-x">
              <div
                aria-hidden
                className="h-3 w-full bg-[repeating-linear-gradient(-45deg,var(--color-foreground),var(--color-foreground)_1px,transparent_1px,transparent_4px)] opacity-5"
              />
              <div className="border-border/25 relative z-2 hidden w-full overflow-hidden border dark:block">
                <div
                  className="relative w-full"
                  style={getImageWrapperStyle(hero.image_invert ?? hero.image)}
                >
                  <LazyImage
                    src={hero.image_invert?.src || hero.image?.src || ''}
                    alt={heroImageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, 1152px"
                    priority={shouldPrioritizeHeroImage}
                    fetchPriority="high"
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="border-border/25 relative z-2 w-full overflow-hidden border dark:hidden">
                <div
                  className="relative w-full"
                  style={getImageWrapperStyle(hero.image ?? hero.image_invert)}
                >
                  <LazyImage
                    src={hero.image?.src || hero.image_invert?.src || ''}
                    alt={heroImageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, 1152px"
                    priority={shouldPrioritizeHeroImage}
                    fetchPriority="high"
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
