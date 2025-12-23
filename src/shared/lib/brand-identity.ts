import { envConfigs } from '@/config';
import type { Sidebar } from '@/shared/types/blocks/dashboard';
import type { Footer, Header } from '@/shared/types/blocks/landing';

type BrandIdentity = {
  name: string;
  url: string;
};

function getBrandIdentity(): BrandIdentity {
  return {
    name: envConfigs.app_name || '',
    url: envConfigs.app_url || '',
  };
}

export function applyBrandToLandingHeaderFooter(params: {
  header: Header;
  footer: Footer;
}): { header: Header; footer: Footer } {
  const brand = getBrandIdentity();

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
                alt: brand.name || params.footer.brand.logo.alt,
              }
            : undefined,
        }
      : params.footer.brand,
  };

  return { header, footer };
}

export function applyBrandToSidebar(sidebar: Sidebar): Sidebar {
  const brand = getBrandIdentity();

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
