'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { BillingRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Button as ButtonType } from '@/shared/types/blocks/common';
import type { PricingItem } from '@/shared/types/blocks/pricing';

export function PaymentProviders({
  billingSettings,
  callbackUrl: _callbackUrl,
  loading,
  setLoading: _setLoading,
  pricingItem,
  onCheckout,
  className,
}: {
  billingSettings: BillingRuntimeSettings;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  pricingItem: PricingItem | null;
  onCheckout: (item: PricingItem, paymentProvider?: string) => void;
  className?: string;
}) {
  const t = useTranslations('common.payment');
  const [paymentProvider, setPaymentProvider] = useState<string | null>(null);

  const handlePayment = async ({ provider }: { provider: string }) => {
    if (!provider) {
      toast.error(t('payment_method_required'));
      return;
    }
    if (!pricingItem) {
      toast.error(t('pricing_item_required'));
      return;
    }

    onCheckout(pricingItem, provider);
  };

  // Get allowed payment providers from pricing item
  // If payment_providers is set, use it; otherwise show all enabled providers
  const allowedProviders = pricingItem?.payment_providers;

  // Helper function to check if a provider is allowed
  const isProviderAllowed = (providerName: string): boolean => {
    // If no payment_providers specified, allow all
    if (!allowedProviders || allowedProviders.length === 0) {
      return true;
    }
    // Check if provider is in the allowed list
    return allowedProviders.includes(providerName);
  };

  const providers: ButtonType[] = [];

  if (billingSettings.stripeEnabled && isProviderAllowed('stripe')) {
    providers.push({
      name: 'stripe',
      title: 'Stripe',
      icon_url: '/imgs/icons/stripe.png',
      onClick: () => handlePayment({ provider: 'stripe' }),
    });
  }

  if (billingSettings.creemEnabled && isProviderAllowed('creem')) {
    providers.push({
      name: 'creem',
      title: 'Creem',
      icon_url: '/imgs/icons/creem.png',
      onClick: () => handlePayment({ provider: 'creem' }),
    });
  }

  if (billingSettings.paypalEnabled && isProviderAllowed('paypal')) {
    providers.push({
      name: 'paypal',
      title: 'PayPal',
      icon_url: '/imgs/icons/paypal.svg',
      onClick: () => handlePayment({ provider: 'paypal' }),
    });
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between',
        className
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className={cn('w-full gap-2')}
          disabled={loading}
          onClick={() => {
            if (!provider.onClick || !provider.name) {
              toast.error(t('invalid_payment_method'));
              return;
            }

            setPaymentProvider(provider.name);
            provider.onClick();
          }}
        >
          {provider.icon_url && (
            <Image
              src={provider.icon_url}
              alt={provider.title || provider.name || ''}
              width={24}
              height={24}
              className="rounded-full"
            />
          )}
          <h3>{provider.title}</h3>
          {paymentProvider === provider.name && loading && (
            <Loader2 className="size-4 animate-spin" />
          )}
        </Button>
      ))}
    </div>
  );
}
