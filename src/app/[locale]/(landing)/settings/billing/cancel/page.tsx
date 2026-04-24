// data: signed-in user (better-auth) + subscription (db) + Server Action cancels via provider then updates db
// cache: no-store (request-bound auth)
// reason: user-specific billing mutation flow
import { notFound } from 'next/navigation';
import { requireActionUser } from '@/app/access-control/action-guard';
import { resolveSitePaymentCapability } from '@/config/payment-capability';
import {
  cancelMemberSubscription,
  readMemberCancelableSubscription,
} from '@/domains/billing/application/member-billing.actions';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import moment from 'moment';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { Empty } from '@/shared/blocks/common/empty';
import { FormCard } from '@/shared/blocks/form';
import { ActionError } from '@/shared/lib/action/errors';
import { parseFormData } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form } from '@/shared/types/blocks/form';

export default async function CancelBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subscription_no: string }>;
}) {
  if (resolveSitePaymentCapability() === 'none') {
    notFound();
  }

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

  const subscriptionResult = await readMemberCancelableSubscription({
    subscriptionNo: subscription_no,
    actorUserId: user.id,
  });
  if (subscriptionResult.status === 'not_found') {
    return <Empty message={tb('errors.subscription_not_found')} />;
  }
  if (subscriptionResult.status === 'missing_subscription_target') {
    return <Empty message={tb('errors.missing_payment_subscription_id')} />;
  }
  if (subscriptionResult.status === 'forbidden') {
    return <Empty message={tb('errors.no_permission')} />;
  }
  if (subscriptionResult.status === 'provider_not_found') {
    return <Empty message={tb('errors.payment_provider_not_found')} />;
  }
  if (subscriptionResult.status !== 'ok') {
    return <Empty message={tb('errors.subscription_not_found')} />;
  }
  const subscription = subscriptionResult.subscription;

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

      const result = await cancelMemberSubscription({
        subscriptionNo: subscription_no,
        actorUserId: user.id,
      });

      if (result.status === 'not_found') {
        throw new ActionError('invalid subscription');
      }
      if (result.status === 'forbidden') {
        throw new ActionError('no permission');
      }
      if (result.status === 'invalid_status') {
        throw new ActionError('subscription is not active or trialing');
      }
      if (result.status === 'missing_provider') {
        throw new ActionError('payment provider not found');
      }
      if (result.status === 'cancel_failed') {
        throw new ActionError('cancel subscription failed');
      }

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
