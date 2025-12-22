import { envConfigs } from '@/config';
import {
  BrandLogo,
  LocaleSelector,
  ThemeToggler,
} from '@/shared/blocks/common';
import { AppContextProvider } from '@/shared/contexts/app';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppContextProvider>
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="absolute top-4 left-4">
          <BrandLogo
            brand={{
              title: envConfigs.app_name,
              logo: {
                src: '/logo.png',
                alt: envConfigs.app_name,
              },
              url: '/',
              target: '_self',
              className: '',
            }}
          />
        </div>
        <div className="absolute top-4 right-4 flex items-center gap-4">
          <ThemeToggler />
          <LocaleSelector type="button" />
        </div>
        <div className="w-full px-4">{children}</div>
      </div>
    </AppContextProvider>
  );
}
