import { ArrowBigRight } from 'lucide-react';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { cn } from '@/shared/lib/utils';
import type { Features as FeaturesType } from '@/shared/types/blocks/landing';

export function FeaturesStep({
  features,
  className,
}: {
  features: FeaturesType;
  className?: string;
}) {
  return (
    <section
      id={features.id}
      className={cn('py-16 md:py-20', features.className, className)}
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          {features.label ? (
            <span className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              {features.label}
            </span>
          ) : null}
          <h2 className="text-foreground mt-4 text-3xl font-semibold md:text-4xl">
            {features.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-balance md:text-lg">
            {features.description}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.items?.map((item, idx) => (
            <div
              className="bg-card border-border/80 flex h-full flex-col rounded-[1.5rem] border p-6 shadow-sm"
              key={idx}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  Step {idx + 1}
                </span>
                {idx < (features.items?.length ?? 0) - 1 ? (
                  <ArrowBigRight className="fill-muted stroke-primary hidden size-5 md:block" />
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="text-primary">
                  {item.icon && (
                    <SmartIcon name={item.icon as string} size={20} />
                  )}
                </div>
                <h3 className="text-foreground text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-6 text-balance">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
