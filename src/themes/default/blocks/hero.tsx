import { ArrowRight } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';
import { LazyImage } from '@/shared/blocks/common/lazy-image';
import { Button } from '@/shared/components/ui/button';
import type { Hero as HeroType } from '@/shared/types/blocks/landing';

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
    <section
      id={hero.id}
      className={`overflow-hidden pt-18 pb-14 md:pt-24 md:pb-18 ${hero.className} ${className}`}
    >
      <div className="container">
        {hero.announcement && (
          <div className="mb-6">
            <Link
              href={hero.announcement.url || ''}
              target={hero.announcement.target || '_self'}
              className="hover:bg-background bg-muted group border-border/80 flex w-fit items-center gap-3 rounded-full border px-4 py-2 shadow-sm transition-colors duration-300"
            >
              <span className="text-foreground text-sm font-medium">
                {hero.announcement.title}
              </span>
              <span className="bg-border block h-4 w-px"></span>

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

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12">
          <div className="max-w-2xl">
            {texts && texts.length > 0 ? (
              <h1 className="text-foreground text-4xl leading-none font-semibold text-balance sm:text-6xl lg:text-7xl">
                {texts[0]}
                <span className="text-primary"> {highlightText}</span>
                {texts[1]}
              </h1>
            ) : (
              <h1 className="text-foreground text-4xl leading-none font-semibold text-balance sm:text-6xl lg:text-7xl">
                {hero.title}
              </h1>
            )}

            <p
              className="text-muted-foreground mt-6 max-w-xl text-base leading-7 text-pretty sm:text-lg"
              dangerouslySetInnerHTML={{ __html: hero.description ?? '' }}
            />

            {hero.buttons && (
              <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap">
                {hero.buttons.map((button, idx) => (
                  <Button
                    asChild
                    size={button.size || 'default'}
                    variant={button.variant || 'default'}
                    className="h-11 px-5 text-sm"
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
                className="text-muted-foreground mt-4 block text-sm"
                dangerouslySetInnerHTML={{ __html: hero.tip ?? '' }}
              />
            )}

            {hero.show_avatars && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="inline-flex items-center -space-x-2">
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
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index} className="text-yellow-400">
                        ★
                      </span>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-sm font-normal">
                    {hero.avatars_tip || ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          {hero.image && (
            <div className="relative">
              <div className="from-primary/10 absolute inset-x-6 top-8 bottom-8 hidden rounded-[2rem] bg-gradient-to-b via-transparent to-transparent lg:block" />
              <div className="bg-background border-border/80 relative overflow-hidden rounded-[2rem] border p-3 shadow-xl shadow-slate-900/7 sm:p-4">
                <div
                  className="bg-muted/60 border-border/70 relative w-full overflow-hidden rounded-[calc(var(--radius)+0.5rem)] border"
                  style={getImageWrapperStyle(hero.image ?? hero.image_invert)}
                >
                  <LazyImage
                    src={hero.image?.src || hero.image_invert?.src || ''}
                    alt={heroImageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 720px"
                    priority={shouldPrioritizeHeroImage}
                    fetchPriority="high"
                    className="object-cover object-top"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
