import assert from 'node:assert/strict';
import test from 'node:test';

import { PaymentCheckoutBodySchema } from './checkout';

test('PaymentCheckoutBodySchema 不再接受 payment_provider', () => {
  const result = PaymentCheckoutBodySchema.safeParse({
    product_id: 'starter',
    payment_provider: 'stripe',
  });

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error?.issues ?? []), /unrecognized_keys/i);
});
