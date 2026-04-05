import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { cn } from '@/shared/lib/utils';
import type { Features as FeaturesType } from '@/shared/types/blocks/landing';

export function Features({
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
      <div className="container space-y-8 md:space-y-12">
        <div className="mx-auto max-w-4xl text-center text-balance">
          <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {features.title}
          </h2>
          <p className="text-muted-foreground mb-6 md:mb-12 lg:mb-16">
            {features.description}
          </p>
        </div>

        <div className="mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.items?.map((item, idx) => (
            <div
              className="bg-card border-border/80 rounded-[1.5rem] border p-6 shadow-sm"
              key={idx}
            >
              <div className="text-primary mb-5">
                <SmartIcon name={item.icon as string} size={20} />
              </div>
              <div className="space-y-3">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-6">
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
