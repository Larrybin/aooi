'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { BorderBeam } from '@/shared/components/magicui/border-beam';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { Features as FeaturesType } from '@/shared/types/blocks/landing';

export function FeaturesAccordion({
  features,
  className,
}: {
  features: FeaturesType;
  className?: string;
}) {
  const items = features.items ?? [];
  const [activeItem, setActiveItem] = useState<string>(
    items.length > 0 ? 'item-1' : ''
  );

  const images = useMemo(() => {
    const byKey: Record<
      string,
      {
        src: string;
        alt: string;
        width?: number;
        height?: number;
      }
    > = {};

    items.forEach((item, idx) => {
      byKey[`item-${idx + 1}`] = {
        src: item.image?.src ?? '',
        alt: item.image?.alt || item.title || '',
        width: item.image?.width,
        height: item.image?.height,
      };
    });

    return byKey;
  }, [items]);

  const fallbackImageSize = { width: 1207, height: 929 };
  const activeImage = activeItem ? images[activeItem] : undefined;

  if (items.length === 0) {
    return null;
  }

  return (
    // overflow-x-hidden to prevent horizontal scroll
    <section className={`overflow-x-hidden py-16 md:py-24 ${className}`}>
      <div className="absolute inset-0 -z-10 bg-linear-to-b sm:inset-6 sm:rounded-b-3xl dark:block dark:to-[color-mix(in_oklab,var(--color-zinc-900)_75%,var(--color-background))]"></div>
      {/* add overflow-x-hidden to container */}
      <div className="container space-y-8 overflow-x-hidden px-2 sm:px-6 md:space-y-16 lg:space-y-20 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        <ScrollAnimation>
          <div className="mx-auto max-w-4xl text-center text-balance">
            <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {features.title}
            </h2>
            <p className="text-muted-foreground mb-6 md:mb-12 lg:mb-16">
              {features.description}
            </p>
          </div>
        </ScrollAnimation>

        {/* grid: clamp min-w-0 and fix px padding/breakpoints */}
        <div className="grid min-w-0 gap-12 sm:px-6 md:grid-cols-2 lg:gap-20 lg:px-0">
          <ScrollAnimation delay={0.1} direction="left">
            <Accordion
              type="single"
              value={activeItem}
              onValueChange={(value) => setActiveItem(value as string)}
              className="w-full"
            >
              {items.map((item, idx) => (
                <AccordionItem value={`item-${idx + 1}`} key={idx}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2 text-base">
                      {item.icon && (
                        <SmartIcon name={item.icon as string} size={24} />
                      )}
                      {item.title}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>{item.description}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollAnimation>

          <ScrollAnimation delay={0.2} direction="right">
            {/* min-w-0/flex-shrink to prevent overflow */}
            <div className="bg-background relative flex min-w-0 flex-shrink overflow-hidden rounded-3xl border p-2">
              <div className="absolute inset-0 right-0 ml-auto w-15 border-l bg-[repeating-linear-gradient(-45deg,var(--color-border),var(--color-border)_1px,transparent_1px,transparent_8px)]"></div>
              <div className="bg-background relative aspect-76/59 w-full min-w-0 rounded-2xl sm:w-[calc(3/4*100%+3rem)]">
                {activeImage ? (
                  <div
                    key={activeItem}
                    className="animate-in fade-in slide-in-from-bottom-1 size-full overflow-hidden rounded-2xl border bg-zinc-900 shadow-md duration-200"
                  >
                    <Image
                      src={activeImage.src}
                      className="size-full object-cover object-left-top dark:mix-blend-lighten"
                      alt={activeImage.alt}
                      width={
                        activeImage.width ?? fallbackImageSize.width
                      }
                      height={
                        activeImage.height ?? fallbackImageSize.height
                      }
                      sizes="(max-width: 640px) 100vw, 75vw"
                      // prevent img from exceeding parent
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  </div>
                ) : null}
              </div>
              <BorderBeam
                duration={6}
                size={200}
                className="from-transparent via-yellow-700 to-transparent dark:via-white/50"
              />
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}
