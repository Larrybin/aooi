// data: signed-in user (better-auth) + subscriptions (db) + payment callback state (query)
// cache: no-store (request-bound auth)
// reason: user-specific billing history and actions
import moment from 'moment';
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { PanelCard } from '@/shared/blocks/panel';
import { PaymentCallbackHandler } from '@/domains/billing/ui/payment-callback';
import { TableCard } from '@/shared/blocks/table';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import {
  getCurrentSubscription,
  getSubscriptions,
  getSubscriptionsCount,
  SubscriptionStatus,
  type Subscription,
} from '@/domains/billing/infra/subscription';
import type { Button as ButtonType, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    status?: string;
    order_no?: string;
  }>;
}) {
  const {
    page: pageNum,
    pageSize,
    status,
    order_no: orderNo,
  } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const cleanQuery = new URLSearchParams();
  if (pageNum) cleanQuery.set('page', String(pageNum));
  if (pageSize) cleanQuery.set('pageSize', String(pageSize));
  if (status) cleanQuery.set('status', String(status));
  const cleanUrl = cleanQuery.toString()
    ? `/settings/billing?${cleanQuery.toString()}`
    : '/settings/billing';

  const t = await getTranslations('settings.billing');

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  const currentSubscription = await getCurrentSubscription(user.id);

  const total = await getSubscriptionsCount({
    userId: user.id,
    status,
  });

  const subscriptions = await getSubscriptions({
    userId: user.id,
    status,
    page,
    limit,
  });

  const table: Table<Subscription> = {
    title: t('list.title'),
    columns: [
      {
        name: 'subscriptionNo',
        title: t('fields.subscription_no'),
        type: 'copy',
      },
      {
        name: 'interval',
        title: t('fields.interval'),
        callback: function (item) {
          if (!item.interval || !item.intervalCount) {
            return '-';
          }
          return <div>{`${item.intervalCount}-${item.interval}`}</div>;
        },
      },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        title: t('fields.amount'),
        callback: function (item: Subscription) {
          const currency = (item.currency || 'USD').toUpperCase();

          let prefix = '';
          if (currency === 'USD') {
            prefix = `$`;
          } else if (currency === 'EUR') {
            prefix = `€`;
          } else if (currency === 'CNY') {
            prefix = `¥`;
          } else {
            prefix = `${currency} `;
          }

          const amount = item.amount ?? 0;

          return (
            <div className="text-primary">{`${prefix}${amount / 100}`}</div>
          );
        },
      },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
      {
        title: t('fields.current_period'),
        callback: function (item) {
          const period = (
            <div>
              {`${moment(item.currentPeriodStart).format('YYYY-MM-DD')}`} ~
              <br />
              {`${moment(item.currentPeriodEnd).format('YYYY-MM-DD')}`}
            </div>
          );

          return period;
        },
      },
      {
        title: t('fields.end_time'),
        callback: function (item) {
          if (item.canceledEndAt) {
            return <div>{moment(item.canceledEndAt).format('YYYY-MM-DD')}</div>;
          }
          return '-';
        },
      },
      {
        title: t('fields.action'),
        type: 'dropdown',
        callback: function (item) {
          if (
            item.status !== SubscriptionStatus.ACTIVE &&
            item.status !== SubscriptionStatus.TRIALING
          ) {
            return null;
          }

          return [
            {
              title: t('view.buttons.cancel'),
              url: `/settings/billing/cancel?subscription_no=${item.subscriptionNo}`,
              icon: 'Ban',
              size: 'sm',
              variant: 'outline',
            },
          ];
        },
      },
    ],
    data: subscriptions,
    pagination: {
      total,
      page,
      limit,
    },
  };

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/settings/billing',
      is_active: !status || status === 'all',
    },
    {
      title: t('list.tabs.active'),
      name: 'active',
      url: '/settings/billing?status=active',
      is_active: status === 'active',
    },
    {
      title: t('list.tabs.trialing'),
      name: 'trialing',
      url: '/settings/billing?status=trialing',
      is_active: status === 'trialing',
    },
    {
      title: t('list.tabs.paused'),
      name: 'paused',
      url: '/settings/billing?status=paused',
      is_active: status === 'paused',
    },
    {
      title: t('list.tabs.expired'),
      name: 'expired',
      url: '/settings/billing?status=expired',
      is_active: status === 'expired',
    },
    {
      title: t('list.tabs.pending_cancel'),
      name: 'pending_cancel',
      url: '/settings/billing?status=pending_cancel',
      is_active: status === 'pending_cancel',
    },
    {
      title: t('list.tabs.canceled'),
      name: 'canceled',
      url: '/settings/billing?status=canceled',
      is_active: status === 'canceled',
    },
  ];

  let buttons: ButtonType[] = [];
  if (currentSubscription) {
    buttons = [
      {
        title: t('view.buttons.adjust'),
        url: '/pricing',
        target: '_blank',
        icon: 'Pencil',
        size: 'sm',
      },
    ];
    if (currentSubscription.paymentUserId) {
      buttons.push({
        title: t('view.buttons.manage'),
        url: `/settings/billing/retrieve?subscription_no=${currentSubscription.subscriptionNo}`,
        target: '_blank',
        icon: 'Settings',
        size: 'sm',
        variant: 'outline',
      });
    }
  } else {
    buttons = [
      {
        title: t('view.buttons.subscribe'),
        url: '/pricing',
        target: '_blank',
        icon: 'ArrowUpRight',
        size: 'sm',
      },
    ];
  }

  return (
    <div className="space-y-8">
      <PaymentCallbackHandler orderNo={orderNo} cleanUrl={cleanUrl} />
      <PanelCard
        label={currentSubscription?.status}
        title={t('view.title')}
        buttons={buttons}
        className="max-w-md"
      >
        <div className="text-primary text-3xl font-bold">
          {currentSubscription?.planName || t('view.no_subscription')}
        </div>
        {currentSubscription ? (
          <>
            {currentSubscription?.status === SubscriptionStatus.ACTIVE ||
            currentSubscription?.status === SubscriptionStatus.TRIALING ? (
              <div className="text-muted-foreground mt-4 text-sm font-normal">
                {t('view.tip', {
                  date: moment(currentSubscription?.currentPeriodEnd).format(
                    'YYYY-MM-DD'
                  ),
                })}
              </div>
            ) : (
              <div className="text-destructive mt-4 text-sm font-normal">
                {t('view.end_tip', {
                  date: moment(currentSubscription?.canceledEndAt).format(
                    'YYYY-MM-DD'
                  ),
                })}
              </div>
            )}
          </>
        ) : null}
      </PanelCard>
      <TableCard title={t('list.title')} tabs={tabs} table={table} />
    </div>
  );
}
