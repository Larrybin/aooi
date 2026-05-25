import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BackgroundRemoverHome } from '@/domains/background-remover/ui/background-remover-home';
import { buildBackgroundRemoverHeaderFooter } from '@/domains/background-remover/ui/background-remover-shell';
import { RemoverHome } from '@/domains/remover/ui/remover-home';
import { buildRemoverHeaderFooter } from '@/domains/remover/ui/remover-shell';
import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  buildMetadataBaseUrl,
} from '@/infra/url/canonical';

import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

type ProductLanding = {
  buildHeaderFooter: (brand: {
    appName: string;
    appLogo: string;
  }) => { header: HeaderType; footer: FooterType };
  render: () => ReactNode;
  metadata: {
    title: string;
    description: string;
    keywords: string[];
  };
};

const PRODUCT_LANDINGS = {
  'ai-remover': {
    buildHeaderFooter: buildRemoverHeaderFooter,
    render: () => <RemoverHome />,
    metadata: {
      title: 'AI Remover - Remove Objects from Photos for Free',
      description:
        'Remove unwanted objects, people, and distractions from photos in seconds with AI Remover.',
      keywords: [
        'ai remover',
        'ai object remover',
        'remove objects from photos',
        'remove unwanted objects from photos',
        'remove people from photos',
      ],
    },
  },
  'background-remover': {
    buildHeaderFooter: buildBackgroundRemoverHeaderFooter,
    render: () => <BackgroundRemoverHome />,
    metadata: {
      title: 'Background Remover - Transparent PNG Maker',
      description:
        'Remove image backgrounds and create transparent PNG cutouts for product photos, profile images, and design assets.',
      keywords: [
        'remove background',
        'background remover',
        'transparent PNG maker',
        'product image cutout',
        'remove background from image',
      ],
    },
  },
} as const satisfies Record<string, ProductLanding>;

export function getProductLanding(siteKey: string): ProductLanding | null {
  return PRODUCT_LANDINGS[siteKey as keyof typeof PRODUCT_LANDINGS] ?? null;
}

export function buildProductLandingMetadata({
  landing,
  locale,
  brand,
}: {
  landing: ProductLanding;
  locale: string;
  brand: {
    appName: string;
    appUrl: string;
    appOgImage: string;
  };
}): Metadata {
  const canonicalUrl = buildCanonicalUrl('/', locale);
  const imageUrl = brand.appOgImage.startsWith('http')
    ? brand.appOgImage
    : `${brand.appUrl}${brand.appOgImage}`;

  return {
    metadataBase: buildMetadataBaseUrl(),
    title: {
      absolute: landing.metadata.title,
    },
    description: landing.metadata.description,
    keywords: landing.metadata.keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: buildLanguageAlternates('/'),
    },
    openGraph: {
      type: 'website',
      locale,
      url: canonicalUrl,
      title: landing.metadata.title,
      description: landing.metadata.description,
      siteName: brand.appName,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title: landing.metadata.title,
      description: landing.metadata.description,
      images: [imageUrl],
      site: brand.appUrl,
    },
  };
}
