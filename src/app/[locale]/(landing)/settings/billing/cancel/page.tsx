// data: signed-in user (better-auth) + subscription (db) + Server Action cancels via provider then updates db
// cache: no-store (request-bound auth)
// reason: user-specific billing mutation flow
import moment from 'moment';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { requireActionUser } from '@/app/access-control/action-guard';
import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { ActionError } from '@/shared/lib/action/errors';
import { parseFormData } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import { readRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';
import {
  findSubscriptionBySubscriptionNo,
  SubscriptionStatus,
  updateSubscriptionBySubscriptionNo,
} from '@/domains/billing/infra/subscription';
import { getPaymentServiceWithConfigs } from '@/infra/adapters/payment/service';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form } from '@/shared/types/blocks/form';

export default async function CancelBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subscription_no: string }>;
}) {
  const t = await getTranslations('settings.billing.cancel');
  const tb = await getTranslations('settings.billing');
  const { locale: _locale } = await params;
  const { subscription_no } = await searchParams;

  if (!subscription_no) {
    return <Empty message={tb('errors.invalid_subscription_no')} />;
  }

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={tb('errors.no_auth')} />;
  }

  const subscription = await findSubscriptionBySubscriptionNo(subscription_no);
  if (!subscription) {
    return <Empty message={tb('errors.subscription_not_found')} />;
  }

  if (!subscription.paymentProvider || !subscription.subscriptionId) {
    return <Empty message={tb('errors.missing_payment_subscription_id')} />;
  }

  if (subscription.userId !== user.id) {
    return <Empty message={tb('errors.no_permission')} />;
  }

  const paymentService = await getPaymentServiceWithConfigs(
    await readRuntimeSettingsCached()
  );
  const paymentProvider = paymentService.getProvider(
    subscription.paymentProvider
  );
  if (!paymentProvider) {
    return <Empty message={tb('errors.payment_provider_not_found')} />;
  }

  const crumb: Crumb[] = [
    {
      title: t('crumbs.settings'),
      url: '/settings',
    },
    {
      title: t('crumbs.billing'),
      url: '/settings/billing',
    },
    {
      title: t('crumbs.cancel'),
      is_active: true,
    },
  ];

  const handleCancelSubscription = async (data: FormData, _passby: unknown) => {
    'use server';

    return withAction(async () => {
      const user = await requireActionUser();
      parseFormData(data, z.record(z.string(), z.string()));
      if (!subscription_no) {
        throw new ActionError('invalid subscription no');
      }

      const subscription =
        await findSubscriptionBySubscriptionNo(subscription_no);
      if (!subscription || !subscription.subscriptionId) {
        throw new ActionError('invalid subscription');
      }

      if (subscription.userId !== user.id) {
        throw new ActionError('no permission');
      }

      if (
        subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== SubscriptionStatus.TRIALING
      ) {
        throw new ActionError('subscription is not active or trialing');
      }

      const paymentService = await getPaymentServiceWithConfigs(
        await readRuntimeSettingsCached()
      );
      const paymentProvider = paymentService.getProvider(
        subscription.paymentProvider
      );

      const result = await paymentProvider?.cancelSubscription?.({
        subscriptionId: subscription.subscriptionId,
      });
      if (!result) {
        throw new ActionError('cancel subscription failed');
      }

      await updateSubscriptionBySubscriptionNo(subscription.subscriptionNo, {
        status: SubscriptionStatus.CANCELED,
      });

      return actionOk('Subscription canceled', '/settings/billing');
    });
  };

  const form: Form = {
    fields: [
      {
        name: 'subscriptionNo',
        title: t('fields.subscription_no'),
        type: 'text',
        attributes: { disabled: true },
      },
      {
        name: 'subAmount',
        title: t('fields.subscription_amount'),
        value: `${subscription.amount ? subscription.amount / 100 : 0} ${subscription.currency}`,
        attributes: { disabled: true },
      },
      {
        name: 'intervalTip',
        title: t('fields.interval_cycle'),
        value: `every ${subscription.intervalCount} ${subscription.interval}`,
        attributes: { disabled: true },
      },
      {
        name: 'subscriptionCreatedAt',
        title: t('fields.subscription_created_at'),
        value: moment(subscription.createdAt).format('YYYY-MM-DD'),
        attributes: { disabled: true },
      },
      {
        name: 'currentPeriod',
        title: t('fields.current_period'),
        value: `${moment(subscription.currentPeriodStart).format('YYYY-MM-DD')} ~ ${moment(subscription.currentPeriodEnd).format('YYYY-MM-DD')}`,
        attributes: { disabled: true },
      },
    ],
    data: subscription,
    passby: {
      subscription: subscription,
      user: user,
    },
    submit: {
      handler: handleCancelSubscription,
      button: {
        title: t('buttons.confirm_cancel'),
        variant: 'destructive',
      },
    },
  };

  return (
    <div className="space-y-8">
      <FormCard
        title={t('title')}
        description={t('description')}
        form={form}
        crumbs={crumb}
      />
    </div>
  );
}
