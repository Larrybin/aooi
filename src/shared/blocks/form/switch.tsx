import * as React from 'react';
import { ControllerRenderProps } from 'react-hook-form';

import { Switch as SwitchComponent } from '@/shared/components/ui/switch';
import { FormField } from '@/shared/types/blocks/form';

export function Switch({
  field: _field,
  formField,
  data: _data,
}: {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
}) {
  return (
    <>
      <SwitchComponent
        checked={Boolean(formField.value)}
        onCheckedChange={formField.onChange}
      />
    </>
  );
}
