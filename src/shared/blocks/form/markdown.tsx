import type { ControllerRenderProps } from 'react-hook-form';

import type { FormField } from '@/shared/types/blocks/form';

import { MarkdownEditor } from '../common/markdown-editor';

export function Markdown({
  field,
  formField,
  data: _data,
}: {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
}) {
  return (
    <MarkdownEditor
      value={formField.value as string}
      onChange={formField.onChange}
      placeholder={field.placeholder || ''}
      {...field.attributes}
    />
  );
}
