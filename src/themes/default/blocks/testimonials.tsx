import Image from 'next/image';

import type { Image as ImageType } from '@/shared/types/blocks/common';
import type { Testimonials as TestimonialsType } from '@/shared/types/blocks/landing';

export function Testimonials({
  testimonials,
  className,
}: {
  testimonials: TestimonialsType;
  className?: string;
}) {
  const TestimonialCard = ({
    name,
    role,
    image,
    quote,
  }: {
    name?: string;
    role?: string;
    image?: ImageType;
    quote?: string;
  }) => {
    return (
      <div className="bg-card ring-foreground/[0.08] border-border/80 flex h-full flex-col justify-between gap-6 rounded-[1.5rem] border p-6 shadow-sm ring-1">
        <p className='text-foreground text-sm leading-7 text-balance before:mr-1 before:content-["\201C"] after:ml-1 after:content-["\201D"] md:text-[0.95rem]'>
          {quote}
        </p>
        <div className="flex items-center gap-3">
          <div className="ring-foreground/10 aspect-square size-9 overflow-hidden rounded-lg border border-transparent shadow-md ring-1 shadow-black/15">
            <Image
              src={image?.src ?? ''}
              alt={image?.alt || name || 'Avatar'}
              className="h-full w-full object-cover"
              width={36}
              height={36}
              loading="lazy"
            />
          </div>
          <h3 className="sr-only">
            {name}, {role}
          </h3>
          <div className="space-y-px">
            <p className="text-sm font-medium">{name} </p>
            <p className="text-muted-foreground text-xs">{role}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      id={testimonials.id}
      className={`py-16 md:py-20 ${testimonials.className} ${className}`}
    >
      <div className="container max-w-6xl">
        <div className="mx-auto max-w-3xl text-center text-balance">
          <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
            {testimonials.title}
          </h2>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-sm leading-6 md:mb-10 md:text-base lg:mb-12">
            {testimonials.description}
          </p>
        </div>
        <div className="relative">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {testimonials.items?.map((item, index) => (
              <TestimonialCard key={index} {...item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
