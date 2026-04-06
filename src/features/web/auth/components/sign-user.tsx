'use client';

import { Fragment } from 'react/jsx-runtime';
import { useSearchParams } from 'next/navigation';
import { Coins, LayoutDashboard, Loader2, LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { signOut } from '@/core/auth/client';
import { Link, usePathname, useRouter } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppContext } from '@/shared/contexts/app';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { filterLandingNavItems } from '@/shared/lib/landing-visibility';
import { cn } from '@/shared/lib/utils';
import type { NavItem, UserNav } from '@/shared/types/blocks/common';

import { SignModal } from './sign-modal';

export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
}) {
  const t = useTranslations('common.sign');
  const { isCheckSign, isShowSignModal, user, setIsShowSignModal, configs } =
    useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userNavItems = filterLandingNavItems(userNav?.items, configs);

  const search = searchParams.toString();
  const callbackUrl = normalizeCallbackUrl(
    `${pathname}${search ? `?${search}` : ''}`
  );
  const signInHref = withCallbackUrl('/sign-in', callbackUrl);

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0"
              data-testid="auth-user-menu-trigger"
            >
              <Avatar>
                <AvatarImage src={user.image || ''} alt={user.name || ''} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {userNav?.show_name && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/profile"
                  >
                    <User />
                    {user.name}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_credits && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/credits"
                  >
                    <Coins />
                    {t('credits_title', {
                      credits: user.credits?.remainingCredits || 0,
                    })}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNavItems.map((item: NavItem, idx: number) => (
              <Fragment key={idx}>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href={item.url || ''}
                    target={item.target || '_self'}
                  >
                    {item.icon && (
                      <SmartIcon
                        name={item.icon as string}
                        className="h-4 w-4"
                      />
                    )}
                    {item.title}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </Fragment>
            ))}

            {user.isAdmin && (
              <>
                <DropdownMenuItem asChild>
                  <Link className="w-full cursor-pointer" href="/admin">
                    <LayoutDashboard />
                    {t('admin_title')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNav?.show_sign_out && (
              <DropdownMenuItem
                className="w-full cursor-pointer"
                data-testid="auth-sign-out-trigger"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        router.push('/');
                      },
                    },
                  })
                }
              >
                <LogOut />
                <span>{t('sign_out_title')}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
          <Button
            asChild
            size={signButtonSize}
            className={cn(
              'border-foreground/10 ml-4 cursor-pointer ring-0',
              isScrolled && 'lg:hidden'
            )}
            aria-expanded={isShowSignModal}
            aria-haspopup="dialog"
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.altKey ||
                event.ctrlKey ||
                event.shiftKey
              ) {
                return;
              }

              event.preventDefault();
              setIsShowSignModal(true);
            }}
          >
            <Link href={signInHref} prefetch={false}>
              {isCheckSign ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span>{t('sign_in_title')}</span>
            </Link>
          </Button>
          <SignModal callbackUrl={callbackUrl} />
        </div>
      )}
    </>
  );
}
