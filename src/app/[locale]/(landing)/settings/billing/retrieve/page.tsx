// data: signed-in user (better-auth) + subscription (db) + provider billing portal URL + redirect
// cache: no-store (request-bound auth)
// reason: user-specific provider portal entry; do not cache redirects
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { envConfigs } from '@/config';
import { Empty } from '@/shared/blocks/common/empty';
import { toErrorMessage } from '@/shared/lib/errors';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import {
  findSubscriptionBySubscriptionNo,
  updateSubscriptionBySubscriptionNo,
} from '@/shared/models/subscription';
import { getPaymentService } from '@/core/payment/providers/service';

export default async function RetrieveBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subscription_no: string }>;
}) {
  const { locale: _locale } = await params;
  const { subscription_no } = await searchParams;
  const t = await getTranslations('settings.billing');

  if (!subscription_no) {
    return <Empty message={t('errors.invalid_subscription_no')} />;
  }

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  const subscription = await findSubscriptionBySubscriptionNo(subscription_no);
  if (!subscription) {
    return <Empty message={t('errors.subscription_not_found')} />;
  }

  if (!subscription.paymentProvider || !subscription.paymentUserId) {
    return <Empty message={t('errors.missing_payment_user_id')} />;
  }

  if (subscription.userId !== user.id) {
    return <Empty message={t('errors.no_permission')} />;
  }

  const paymentService = await getPaymentService();
  const paymentProvider = paymentService.getProvider(
    subscription.paymentProvider
  );
  if (!paymentProvider) {
    return <Empty message={t('errors.payment_provider_not_found')} />;
  }

  let billingUrl = '';

  try {
    const billing = await paymentProvider.getPaymentBilling?.({
      customerId: subscription.paymentUserId,
      returnUrl: `${envConfigs.app_url}/settings/billing`,
    });
    if (!billing?.billingUrl) {
      return <Empty message={t('errors.billing_url_not_found')} />;
    }

    billingUrl = billing.billingUrl;

    await updateSubscriptionBySubscriptionNo(subscription.subscriptionNo, {
      billingUrl: billing.billingUrl,
    });
  } catch (error: unknown) {
    return (
      <Empty
        message={toErrorMessage(error) || t('errors.get_billing_failed')}
      />
    );
  }

  if (!billingUrl) {
    return <Empty message={t('errors.billing_url_not_found')} />;
  }

  redirect(billingUrl);
}
