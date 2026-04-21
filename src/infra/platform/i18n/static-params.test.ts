import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLocaleSlugStaticParams,
  getLocaleStaticParams,
} from './static-params';

test('getLocaleStaticParams: 为每个 locale 生成静态参数', () => {
  assert.deepEqual(getLocaleStaticParams(['en', 'zh']), [
    { locale: 'en' },
    { locale: 'zh' },
  ]);
});

test('getLocaleSlugStaticParams: 去重并忽略空 slug', () => {
  assert.deepEqual(
    getLocaleSlugStaticParams(['en', 'zh'], [
      { slug: 'alpha' },
      { slug: 'beta' },
      { slug: 'alpha' },
      { slug: '  ' },
    ]),
    [
      { locale: 'en', slug: 'alpha' },
      { locale: 'en', slug: 'beta' },
      { locale: 'zh', slug: 'alpha' },
      { locale: 'zh', slug: 'beta' },
    ]
  );
});
