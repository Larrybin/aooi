import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';
import type { Pricing as PricingType } from '@/shared/types/blocks/pricing';
import { FAQ, Pricing, Testimonials } from '@/themes/default/blocks';

export default async function PricingPage({
  locale: _locale,
  pricing,
  faq,
  testimonials,
}: {
  locale?: string;
  pricing: PricingType;
  faq?: FAQType;
  testimonials?: TestimonialsType;
}) {
  return (
    <div className="overflow-hidden">
      <Pricing pricing={pricing} className="pb-14 md:pb-16" />
      {faq && (
        <div className="border-border/60 bg-muted/35 border-y">
          <FAQ faq={faq} className="py-14 md:py-18" />
        </div>
      )}
      {testimonials && (
        <Testimonials
          testimonials={testimonials}
          className="pt-14 pb-18 md:pt-18 md:pb-24"
        />
      )}
    </div>
  );
}
