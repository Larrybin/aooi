import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAdminQueryUrl,
  isAdminTabActive,
  normalizeAdminSearchParams,
} from './create-admin-table-page.helpers';

type AdminTabConfig<TQuery extends Record<string, unknown>> = {
  name: string;
  titleKey: string;
  queryPatch?: Partial<TQuery>;
};

test('normalizeAdminSearchParams: 展平数组并保留字符串值', () => {
  assert.deepEqual(
    normalizeAdminSearchParams({
      page: ['2'],
      status: 'paid',
      empty: undefined,
    }),
    {
      page: '2',
      status: 'paid',
      empty: undefined,
    }
  );
});

test('buildAdminQueryUrl: 切换 tab 时清空同组 query 并重置 page', () => {
  assert.equal(
    buildAdminQueryUrl(
      {
        page: '3',
        pageSize: '30',
        type: 'subscription',
        status: 'paid',
      },
      { type: 'one-time' },
      ['type']
    ),
    '?pageSize=30&status=paid&type=one-time'
  );

  assert.equal(
    buildAdminQueryUrl(
      {
        page: '3',
        pageSize: '30',
        type: 'subscription',
      },
      undefined,
      ['type']
    ),
    '?pageSize=30'
  );
});

test('isAdminTabActive: all tab 仅在分组字段为空时激活', () => {
  const tabs: AdminTabConfig<{ type: string | undefined }>[] = [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: 'subscription',
      titleKey: 'list.tabs.subscription',
      queryPatch: { type: 'subscription' },
    },
  ];

  assert.equal(isAdminTabActive({ type: undefined }, tabs, tabs[0]!), true);
  assert.equal(
    isAdminTabActive({ type: 'subscription' }, tabs, tabs[0]!),
    false
  );
  assert.equal(
    isAdminTabActive({ type: 'subscription' }, tabs, tabs[1]!),
    true
  );
});
