import type { ControllerRenderProps } from 'react-hook-form';

import { Input as InputComponent } from '@/shared/components/ui/input';
import type { FormField } from '@/shared/types/blocks/form';

export function Input({
  field,
  formField,
  data: _data,
}: {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
}) {
  return (
    <InputComponent
      value={formField.value as string}
      onChange={formField.onChange}
      type={field.type || 'text'}
      name={field.name}
      placeholder={field.placeholder}
      className="bg-background placeholder:text-base-content/50 rounded-md"
      data-testid={field.name ? `form-control-${field.name}` : undefined}
      {...field.attributes}
    />
  );
}
