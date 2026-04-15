import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFieldSchema,
  buildFormDefaultValues,
  buildFormSchema,
  serializeFieldValue,
} from './field-registry';

test('buildFormSchema: 未知字段类型严格报错', () => {
  assert.throws(
    () =>
      buildFormSchema([
        {
          name: 'x',
          title: 'X',
          type: 'unknown_type' as never,
        },
      ]),
    /Unsupported form field type/
  );
});

test('buildFormDefaultValues: upload_image 多图字段默认值收敛为数组', () => {
  const defaults = buildFormDefaultValues({
    fields: [
      {
        name: 'gallery',
        title: 'Gallery',
        type: 'upload_image',
        metadata: { max: 3 },
      },
    ],
    data: {
      gallery: 'https://a.png,https://b.png',
    },
  });

  assert.deepEqual(defaults.gallery, ['https://a.png', 'https://b.png']);
});

test('serializeFieldValue: checkbox 与多图 upload 统一 JSON 序列化', () => {
  const checkboxSerialized = serializeFieldValue({
    field: {
      name: 'methods',
      title: 'Methods',
      type: 'checkbox',
    },
    value: ['card', 'alipay'],
  });
  const uploadSerialized = serializeFieldValue({
    field: {
      name: 'gallery',
      title: 'Gallery',
      type: 'upload_image',
      metadata: { max: 2 },
    },
    value: ['https://a.png', 'https://b.png'],
  });

  assert.equal(checkboxSerialized, '["card","alipay"]');
  assert.equal(uploadSerialized, '["https://a.png","https://b.png"]');
});

test('buildFieldSchema: number 字段保持数字校验语义', () => {
  const schema = buildFieldSchema({
    name: 'retry',
    title: 'Retry',
    type: 'number',
    validation: {
      required: true,
      min: 1,
      max: 3,
    },
  });

  assert.equal(schema.safeParse('2').success, true);
  assert.equal(schema.safeParse('0').success, false);
  assert.equal(schema.safeParse('abc').success, false);
});
