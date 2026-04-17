import assert from 'node:assert/strict';
import test from 'node:test';

import { AIMediaType } from '@/extensions/ai';
import { PaymentType } from '@/extensions/payment';

import {
  AdminAiTasksListQuerySchema,
  AdminPaymentsListQuerySchema,
  AdminRolesListQuerySchema,
  AdminUsersListQuerySchema,
} from './index';

test('AdminPaymentsListQuerySchema: 解析默认分页并收敛 all/空字符串', () => {
  const query = AdminPaymentsListQuerySchema.parse({
    page: '0',
    pageSize: '999',
    type: 'all',
    status: 'paid',
    provider: '',
    orderNo: '  order_123  ',
  });

  assert.deepEqual(query, {
    page: 1,
    pageSize: 200,
    type: undefined,
    status: 'paid',
    provider: undefined,
    orderNo: 'order_123',
  });
});

test('AdminAiTasksListQuerySchema: 解析 canonical media type', () => {
  const query = AdminAiTasksListQuerySchema.parse({
    page: '2',
    pageSize: '20',
    type: AIMediaType.SPEECH,
  });

  assert.deepEqual(query, {
    page: 2,
    pageSize: 20,
    type: AIMediaType.SPEECH,
  });
});

test('AdminRolesListQuerySchema: 解析 includeDeleted 布尔值', () => {
  assert.deepEqual(AdminRolesListQuerySchema.parse({ includeDeleted: 'true' }), {
    includeDeleted: true,
  });
  assert.deepEqual(AdminRolesListQuerySchema.parse({ includeDeleted: '1' }), {
    includeDeleted: true,
  });
  assert.deepEqual(AdminRolesListQuerySchema.parse({ includeDeleted: 'false' }), {
    includeDeleted: false,
  });
});

test('AdminUsersListQuerySchema: trim email 并补默认分页', () => {
  const query = AdminUsersListQuerySchema.parse({
    email: '  hello@example.com ',
  });

  assert.deepEqual(query, {
    page: 1,
    pageSize: 30,
    email: 'hello@example.com',
  });
});

test('AdminPaymentsListQuerySchema: 接受 canonical payment type', () => {
  const query = AdminPaymentsListQuerySchema.parse({
    type: PaymentType.SUBSCRIPTION,
  });

  assert.equal(query.type, PaymentType.SUBSCRIPTION);
});
