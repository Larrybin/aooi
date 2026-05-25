import type {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export function buildBackgroundRemoverHeaderFooter(brand: {
  appName: string;
  appLogo: string;
}) {
  const header: HeaderType = {
    id: 'header',
    brand: {
      title: brand.appName,
      logo: {
        src: brand.appLogo,
        alt: brand.appName,
        width: 512,
        height: 512,
      },
      url: '/',
    },
    nav: {
      items: [
        {
          title: 'Pricing',
          url: '/pricing',
          icon: 'DollarSign',
        },
      ],
    },
    buttons: [],
    user_nav: {
      show_name: true,
      show_credits: true,
      show_sign_out: true,
      items: [
        {
          title: 'Billing',
          url: '/settings/billing',
          icon: 'CreditCard',
        },
      ],
    },
    show_sign: true,
    show_locale: false,
  };

  const footer: FooterType = {
    id: 'footer',
    brand: {
      title: brand.appName,
      description:
        'Remove image backgrounds and export transparent PNG cutouts.',
      logo: {
        src: brand.appLogo,
        alt: brand.appName,
        width: 512,
        height: 512,
      },
      url: '/',
    },
    nav: {
      items: [
        {
          title: 'Product',
          children: [
            { title: 'Background Remover', url: '/' },
            { title: 'Pricing', url: '/pricing' },
          ],
        },
        {
          title: 'Trust',
          children: [
            { title: 'Privacy Policy', url: '/privacy-policy' },
            { title: 'Terms of Service', url: '/terms-of-service' },
          ],
        },
      ],
    },
    copyright: `© ${new Date().getFullYear()} ${brand.appName}. All rights reserved.`,
    agreement: {
      items: [
        { title: 'Privacy Policy', url: '/privacy-policy' },
        { title: 'Terms of Service', url: '/terms-of-service' },
      ],
    },
  };

  return { header, footer };
}
