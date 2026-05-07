import assert from 'node:assert/strict';
import test from 'node:test';

import { OrderStatus } from '@/domains/billing/infra/order';

import { buildFailedCheckoutOrderUpdate } from './checkout';

test('buildFailedCheckoutOrderUpdate records provider checkout failures as failed', () => {
  const checkoutOrder = {
    description: 'Pro',
    customer: {
      email: 'user@example.com',
    },
    metadata: {
      order_no: 'order_1',
      user_id: 'user_1',
    },
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/pricing',
    price: {
      amount: 999,
      currency: 'USD',
    },
  };

  const update = buildFailedCheckoutOrderUpdate(checkoutOrder);

  assert.equal(update.status, OrderStatus.FAILED);
  assert.equal(update.checkoutInfo, JSON.stringify(checkoutOrder));
});
