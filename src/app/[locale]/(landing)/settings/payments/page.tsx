// data: signed-in user (better-auth) + paid orders (db) + payment callback state (query) + pagination/filter
// cache: no-store (request-bound auth)
// reason: user-specific payment history and invoices
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common/empty';
import { PaymentCallbackHandler } from '@/shared/blocks/payment/payment-callback';
import { TableCard } from '@/shared/blocks/table';
import { getSignedInUserIdentity } from '@/shared/lib/auth-session.server';
import {
  getOrders,
  getOrdersCount,
  OrderStatus,
  type Order,
} from '@/shared/models/order';
import type { Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';
import type { PaymentType } from '@/shared/types/payment';

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    type?: string;
    order_no?: string;
  }>;
}) {
  const {
    page: pageNum,
    pageSize,
    type,
    order_no: orderNo,
  } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const cleanQuery = new URLSearchParams();
  if (pageNum) cleanQuery.set('page', String(pageNum));
  if (pageSize) cleanQuery.set('pageSize', String(pageSize));
  if (type) cleanQuery.set('type', String(type));
  const cleanUrl = cleanQuery.toString()
    ? `/settings/payments?${cleanQuery.toString()}`
    : '/settings/payments';

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.payments');

  const total = await getOrdersCount({
    paymentType: type as PaymentType,
    userId: user.id,
    status: OrderStatus.PAID,
  });

  const orders = await getOrders({
    paymentType: type as PaymentType,
    userId: user.id,
    status: OrderStatus.PAID,
    page,
    limit,
  });

  const table: Table<Order> = {
    title: t('list.title'),
    columns: [
      { name: 'orderNo', title: t('fields.order_no'), type: 'copy' },
      { name: 'productName', title: t('fields.product_name') },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        name: 'paymentType',
        title: t('fields.type'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        title: t('fields.price'),
        callback: function (item: Order) {
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
        title: t('fields.paid_amount'),
        callback: function (item: Order) {
          const currency = (item.paymentCurrency || 'USD').toUpperCase();

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

          const amount = item.paymentAmount ?? 0;

          return (
            <div className="text-primary">{`${prefix}${amount / 100}`}</div>
          );
        },
      },
      {
        title: t('fields.discount_amount'),
        callback: function (item: Order) {
          const currency = (item.discountCurrency || 'USD').toUpperCase();

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

          const amount = item.discountAmount ?? 0;

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
        name: 'actions',
        type: 'dropdown',
        callback: (item: Order) => {
          if (item.invoiceUrl) {
            return [
              {
                title: t('fields.actions.view_invoice'),
                url: item.invoiceUrl,
                target: '_blank',
                icon: 'ArrowUpRight',
              },
            ];
          } else if (item.invoiceId) {
            return [
              {
                title: t('fields.actions.view_invoice'),
                url: `/settings/invoices/retrieve?order_no=${item.orderNo}`,
                icon: 'ArrowUpRight',
              },
            ];
          }
        },
      },
    ],
    data: orders,
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
      url: '/settings/payments',
      is_active: !type || type === 'all',
    },
    {
      title: t('list.tabs.one-time'),
      name: 'one-time',
      url: '/settings/payments?type=one-time',
      is_active: type === 'one-time',
    },
    {
      title: t('list.tabs.subscription'),
      name: 'subscription',
      url: '/settings/payments?type=subscription',
      is_active: type === 'subscription',
    },
    {
      title: t('list.tabs.renew'),
      name: 'renew',
      url: '/settings/payments?type=renew',
      is_active: type === 'renew',
    },
  ];

  return (
    <div className="space-y-8">
      <PaymentCallbackHandler orderNo={orderNo} cleanUrl={cleanUrl} />
      <TableCard
        title={t('list.title')}
        description={t('list.description')}
        tabs={tabs}
        table={table}
      />
    </div>
  );
}
