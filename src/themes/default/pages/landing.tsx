import { AdZone } from '@/extensions/ads';
import type { Landing } from '@/shared/types/blocks/landing';
import { LandingPageView } from '@/themes/default/pages/landing-view';

export default async function LandingPage({
  locale: _locale,
  page,
}: {
  locale?: string;
  page: Landing;
}) {
  return (
    <LandingPageView
      page={page}
      landingInlinePrimaryAd={
        <AdZone
          zone="landing_inline_primary"
          className="py-4 md:py-6"
          containerClassName="container"
        />
      }
    />
  );
}
