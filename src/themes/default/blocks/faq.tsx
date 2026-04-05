'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import type { FAQ as FAQType } from '@/shared/types/blocks/landing';

export function FAQ({ faq, className }: { faq: FAQType; className?: string }) {
  return (
    <section id={faq.id} className={`py-16 md:py-20 ${className}`}>
      <div className="mx-auto max-w-full px-4 md:max-w-4xl md:px-8">
        <ScrollAnimation>
          <div className="mx-auto max-w-3xl text-center text-balance">
            <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight md:text-4xl">
              {faq.title}
            </h2>
            <p className="text-muted-foreground mx-auto mb-6 max-w-2xl text-sm leading-6 md:mb-10 md:text-base lg:mb-12">
              {faq.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="mx-auto mt-8 max-w-full">
            <Accordion
              type="single"
              collapsible
              className="bg-background/92 border-border/80 w-full rounded-[1.75rem] border p-3 shadow-sm"
            >
              {faq.items?.map((item, idx) => (
                <div className="group" key={idx}>
                  <AccordionItem
                    value={item.question ?? ''}
                    className="peer data-[state=open]:bg-card rounded-[1.2rem] border-none px-5 py-1 data-[state=open]:shadow-sm md:px-7"
                  >
                    <AccordionTrigger className="cursor-pointer py-5 text-left text-base font-medium hover:no-underline md:text-[1.05rem]">
                      {item.question ?? ''}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-muted-foreground pb-5 text-sm leading-7 md:text-base">
                        {item.answer ?? ''}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <hr className="mx-5 border-dashed group-last:hidden peer-data-[state=open]:opacity-0 md:mx-7" />
                </div>
              ))}
            </Accordion>

            <p
              className="text-muted-foreground mt-6 px-2 text-center text-sm leading-6 md:px-8 md:text-base"
              dangerouslySetInnerHTML={{ __html: faq.tip ?? '' }}
            />
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
