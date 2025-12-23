import type { Subscription } from '@/shared/models/subscription';
import type {
  FAQ as FAQType,
  Testimonials as TestimonialsType,
} from '@/shared/types/blocks/landing';
import type { Pricing as PricingType } from '@/shared/types/blocks/pricing';
import { FAQ, Pricing, Testimonials } from '@/themes/default/blocks';

export default async function PricingPage({
  locale: _locale,
  pricing,
  currentSubscription,
  faq,
  testimonials,
}: {
  locale?: string;
  pricing: PricingType;
  currentSubscription?: Subscription;
  faq?: FAQType;
  testimonials?: TestimonialsType;
}) {
  return (
    <>
      <Pricing pricing={pricing} currentSubscription={currentSubscription} />
      {faq && <FAQ faq={faq} />}
      {testimonials && <Testimonials testimonials={testimonials} />}
    </>
  );
}
