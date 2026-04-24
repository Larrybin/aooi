import { Fragment, type ReactNode } from 'react';

import type { Landing } from '@/shared/types/blocks/landing';
import {
  CTA,
  FAQ,
  Features,
  FeaturesAccordion,
  FeaturesList,
  FeaturesStep,
  Hero,
  Logos,
  Stats,
  Subscribe,
  Testimonials,
} from '@/themes/default/blocks';

type LandingSectionDefinition = {
  key: string;
  render: (page: Landing) => ReactNode;
};

const LANDING_SECTION_DEFINITIONS: LandingSectionDefinition[] = [
  {
    key: 'hero',
    render: (page) => (page.hero ? <Hero hero={page.hero} /> : null),
  },
  {
    key: 'logos',
    render: (page) => (page.logos ? <Logos logos={page.logos} /> : null),
  },
  {
    key: 'introduce',
    render: (page) =>
      page.introduce ? <FeaturesList features={page.introduce} /> : null,
  },
  {
    key: 'benefits',
    render: (page) =>
      page.benefits ? <FeaturesAccordion features={page.benefits} /> : null,
  },
  {
    key: 'usage',
    render: (page) =>
      page.usage ? <FeaturesStep features={page.usage} /> : null,
  },
  {
    key: 'features',
    render: (page) =>
      page.features ? <Features features={page.features} /> : null,
  },
  {
    key: 'stats',
    render: (page) =>
      page.stats ? <Stats stats={page.stats} className="bg-muted" /> : null,
  },
  {
    key: 'testimonials',
    render: (page) =>
      page.testimonials ? (
        <Testimonials testimonials={page.testimonials} />
      ) : null,
  },
  {
    key: 'subscribe',
    render: (page) =>
      page.subscribe ? (
        <Subscribe subscribe={page.subscribe} className="bg-muted" />
      ) : null,
  },
  {
    key: 'faq',
    render: (page) => (page.faq ? <FAQ faq={page.faq} /> : null),
  },
  {
    key: 'cta',
    render: (page) =>
      page.cta ? <CTA cta={page.cta} className="bg-muted" /> : null,
  },
];

export function renderLandingPageSections(
  page: Landing,
  landingInlinePrimaryAd?: ReactNode
) {
  const sections: ReactNode[] = [];
  let hasInsertedLandingAd = false;

  for (const definition of LANDING_SECTION_DEFINITIONS) {
    const content = definition.render(page);
    if (!content) {
      continue;
    }

    sections.push(<Fragment key={definition.key}>{content}</Fragment>);

    if (!hasInsertedLandingAd && landingInlinePrimaryAd) {
      sections.push(
        <Fragment key="landing_inline_primary">
          {landingInlinePrimaryAd}
        </Fragment>
      );
      hasInsertedLandingAd = true;
    }
  }

  return sections;
}

export function LandingPageView({
  page,
  landingInlinePrimaryAd,
}: {
  page: Landing;
  landingInlinePrimaryAd?: ReactNode;
}) {
  return <>{renderLandingPageSections(page, landingInlinePrimaryAd)}</>;
}
