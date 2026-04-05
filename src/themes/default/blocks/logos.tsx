import Image from 'next/image';

import { cn } from '@/shared/lib/utils';
import type { Logos as LogosType } from '@/shared/types/blocks/landing';

export function Logos({
  logos,
  className,
}: {
  logos: LogosType;
  className?: string;
}) {
  return (
    <section
      id={logos.id}
      className={cn('py-10 md:py-14', logos.className, className)}
    >
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-muted-foreground text-center text-xs font-semibold tracking-[0.24em] uppercase">
          {logos.title}
        </p>
        <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
          {logos.items?.map((item, idx) => (
            <Image
              key={idx}
              className="h-10 w-fit opacity-70 saturate-0 transition-opacity duration-200 hover:opacity-100"
              src={item.image?.src ?? ''}
              alt={item.image?.alt || item.title || item.name || 'Logo'}
              height={28}
              width={140}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
