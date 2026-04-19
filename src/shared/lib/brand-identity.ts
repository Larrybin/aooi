import { buildBrandPlaceholderValues } from '@/shared/lib/brand-placeholders.server';
import type { Footer, Header } from '@/shared/types/blocks/landing';
import type { Sidebar } from '@/shared/types/blocks/workspace';

type BrandIdentity = {
  name: string;
  url: string;
  logoSrc: string;
};

function getBrandIdentity(configs?: Record<string, string>): BrandIdentity {
  const brand = buildBrandPlaceholderValues(configs);
  return {
    name: brand.appName || '',
    url: brand.appUrl || '',
    logoSrc: brand.appLogo || '/logo.png',
  };
}

export function applyBrandToLandingHeaderFooter(params: {
  header: Header;
  footer: Footer;
  configs?: Record<string, string>;
}): { header: Header; footer: Footer } {
  const brand = getBrandIdentity(params.configs);

  const header = {
    ...params.header,
    brand: params.header.brand
      ? {
          ...params.header.brand,
          title: brand.name || params.header.brand.title,
          url: params.header.brand.url || brand.url,
          logo: params.header.brand.logo
            ? {
                ...params.header.brand.logo,
                src: brand.logoSrc || params.header.brand.logo.src,
                alt: brand.name || params.header.brand.logo.alt,
              }
            : undefined,
        }
      : params.header.brand,
  };

  const footer = {
    ...params.footer,
    brand: params.footer.brand
      ? {
          ...params.footer.brand,
          title: brand.name || params.footer.brand.title,
          url: params.footer.brand.url || brand.url,
          logo: params.footer.brand.logo
            ? {
                ...params.footer.brand.logo,
                src: brand.logoSrc || params.footer.brand.logo.src,
                alt: brand.name || params.footer.brand.logo.alt,
              }
            : undefined,
        }
      : params.footer.brand,
  };

  return { header, footer };
}

export function applyBrandToSidebar(
  sidebar: Sidebar,
  configs?: Record<string, string>
): Sidebar {
  const brand = getBrandIdentity(configs);

  const header = sidebar.header?.brand
    ? {
        ...sidebar.header,
        brand: {
          ...sidebar.header.brand,
          title: brand.name || sidebar.header.brand.title,
          url: sidebar.header.brand.url || brand.url,
          logo: sidebar.header.brand.logo
            ? {
                ...sidebar.header.brand.logo,
                src: brand.logoSrc || sidebar.header.brand.logo.src,
                alt: brand.name || sidebar.header.brand.logo.alt,
              }
            : undefined,
        },
      }
    : sidebar.header;

  return {
    ...sidebar,
    header,
  };
}
