import * as React from 'react';
import type { ControllerRenderProps } from 'react-hook-form';

import {
  Select as SelectComponent,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { FormField } from '@/shared/types/blocks/form';

export function Select({
  field,
  formField,
  data: _data,
}: {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
}) {
  return (
    <SelectComponent
      value={String(formField.value ?? '')}
      onValueChange={formField.onChange}
      defaultValue={field.value as string | undefined}
      {...field.attributes}
    >
      <SelectTrigger
        className="bg-background w-full rounded-md"
        data-testid={field.name ? `form-control-${field.name}` : undefined}
      >
        <SelectValue placeholder={field.placeholder} />
      </SelectTrigger>
      <SelectContent className="bg-background rounded-md">
        {field.options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.title}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectComponent>
  );
}
