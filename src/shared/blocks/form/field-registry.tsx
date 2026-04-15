'use client';

import { Textarea } from '@/shared/components/ui/textarea';
import { tryJsonParse } from '@/shared/lib/json';
import type { FormField as FormFieldType } from '@/shared/types/blocks/form';
import type { ControllerRenderProps } from 'react-hook-form';
import { z } from 'zod';

import { Checkbox } from './checkbox';
import { Input } from './input';
import { Markdown } from './markdown';
import { Select } from './select';
import { Switch } from './switch';
import { UploadImage } from './upload-image';

type KnownFieldType = NonNullable<FormFieldType['type']>;

type RenderFieldArgs = {
  field: FormFieldType;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
};

const SUPPORTED_FIELD_TYPES: ReadonlySet<KnownFieldType> = new Set([
  'text',
  'textarea',
  'number',
  'email',
  'password',
  'select',
  'url',
  'editor',
  'code_editor',
  'richtext_editor',
  'markdown_editor',
  'switch',
  'checkbox',
  'upload_image',
]);

function isMultipleUploadField(field: FormFieldType): boolean {
  return (
    field.type === 'upload_image' &&
    typeof field.metadata?.max === 'number' &&
    field.metadata.max > 1
  );
}

function ensureSupportedFieldType(field: FormFieldType): KnownFieldType {
  const fieldType = field.type || 'text';
  if (SUPPORTED_FIELD_TYPES.has(fieldType)) {
    return fieldType;
  }

  throw new Error(
    `Unsupported form field type: "${fieldType}" (field: ${field.name || 'unnamed'})`
  );
}

function buildStringSchema(field: FormFieldType) {
  let schema = z.string();

  if (field.validation?.required) {
    schema = schema.min(1, {
      message: field.validation.message || `${field.title} is required`,
    });
  }

  if (field.validation?.min) {
    schema = schema.min(field.validation.min, {
      message:
        field.validation.message ||
        `${field.title} must be at least ${field.validation.min} characters`,
    });
  }

  if (field.validation?.max) {
    schema = schema.max(field.validation.max, {
      message:
        field.validation.message ||
        `${field.title} must be at most ${field.validation.max} characters`,
    });
  }

  if (field.validation?.email) {
    schema = schema.email({
      message:
        field.validation.message || `${field.title} must be a valid email`,
    });
  }

  return schema;
}

function buildNumberSchema(field: FormFieldType) {
  let schema = z.union([z.number(), z.string()]);

  if (field.validation?.required) {
    schema = schema.refine(
      (value) => value !== null && value !== undefined && value !== '',
      {
        message: field.validation.message || `${field.title} is required`,
      }
    );
  }

  schema = schema.refine(
    (value) => {
      const parsed = typeof value === 'number' ? value : Number(value);
      return !Number.isNaN(parsed) && Number.isFinite(parsed);
    },
    {
      message:
        field.validation?.message || `${field.title} must be a valid number`,
    }
  );

  if (field.validation?.min !== undefined) {
    schema = schema.refine(
      (value) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return parsed >= field.validation!.min!;
      },
      {
        message:
          field.validation?.message ||
          `${field.title} must be at least ${field.validation.min}`,
      }
    );
  }

  if (field.validation?.max !== undefined) {
    schema = schema.refine(
      (value) => {
        const parsed = typeof value === 'number' ? value : Number(value);
        return parsed <= field.validation!.max!;
      },
      {
        message:
          field.validation?.message ||
          `${field.title} must be at most ${field.validation.max}`,
      }
    );
  }

  return schema;
}

function parseCheckboxDefaultValue(
  value: unknown
): string[] | string | undefined | null {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string') {
    const parsed = tryJsonParse<unknown>(value);
    if (parsed.ok && Array.isArray(parsed.value)) {
      return parsed.value.map((item) => String(item));
    }
    return value;
  }
  return value as string | undefined | null;
}

export function buildFieldSchema(field: FormFieldType) {
  const fieldType = ensureSupportedFieldType(field);

  if (fieldType === 'switch') {
    return z.boolean();
  }

  if (fieldType === 'number') {
    return buildNumberSchema(field);
  }

  if (fieldType === 'checkbox') {
    return z.array(z.string());
  }

  if (fieldType === 'upload_image' && isMultipleUploadField(field)) {
    let schema = z.array(z.string());

    if (field.validation?.required) {
      schema = schema.min(1, {
        message: field.validation.message || `${field.title} is required`,
      });
    }

    return schema;
  }

  if (fieldType === 'upload_image') {
    let schema = z.string();

    if (field.validation?.required) {
      schema = schema.min(1, {
        message: field.validation.message || `${field.title} is required`,
      });
    }

    return schema;
  }

  return buildStringSchema(field);
}

export function buildFormSchema(fields: FormFieldType[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (!field.name) continue;
    schemaFields[field.name] = buildFieldSchema(field);
  }

  return z.object(schemaFields);
}

export function buildFieldDefaultValue({
  field,
  data,
}: {
  field: FormFieldType;
  data?: Record<string, unknown>;
}) {
  const fieldType = ensureSupportedFieldType(field);
  const incoming =
    (data as Record<string, unknown> | undefined)?.[field.name || ''] ??
    field.value;

  if (fieldType === 'switch') {
    return (
      incoming === true ||
      incoming === 'true' ||
      incoming === 1 ||
      incoming === '1'
    );
  }

  if (fieldType === 'number') {
    return incoming !== null && incoming !== undefined ? String(incoming) : '';
  }

  if (fieldType === 'checkbox') {
    return parseCheckboxDefaultValue(incoming) ?? [];
  }

  if (fieldType === 'upload_image' && isMultipleUploadField(field)) {
    if (typeof incoming === 'string' && incoming) {
      return incoming.split(',').filter(Boolean);
    }
    if (Array.isArray(incoming)) {
      return incoming;
    }
    return [];
  }

  const value =
    (data as Record<string, unknown> | undefined)?.[field.name || ''] ??
    field.value;
  return value ?? '';
}

export function buildFormDefaultValues({
  fields,
  data,
}: {
  fields: FormFieldType[];
  data?: Record<string, unknown>;
}): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.name) continue;
    defaults[field.name] = buildFieldDefaultValue({ field, data });
  }
  return defaults;
}

export function serializeFieldValue({
  field,
  value,
}: {
  field: FormFieldType;
  value: unknown;
}): string {
  const fieldType = ensureSupportedFieldType(field);

  if (fieldType === 'checkbox') {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }

  if (fieldType === 'upload_image' && isMultipleUploadField(field)) {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }

  if (fieldType === 'switch') {
    return String(Boolean(value));
  }

  if (fieldType === 'number') {
    return value === null || value === undefined ? '' : String(value);
  }

  return value === null || value === undefined ? '' : String(value);
}

export function renderFormFieldControl({
  field,
  formField,
  data,
}: RenderFieldArgs) {
  const fieldType = ensureSupportedFieldType(field);

  if (fieldType === 'textarea') {
    return (
      <Textarea
        name={formField.name}
        value={formField.value as string}
        onChange={formField.onChange}
        onBlur={formField.onBlur}
        ref={formField.ref}
        placeholder={field.placeholder}
        {...field.attributes}
      />
    );
  }

  if (fieldType === 'select') {
    return <Select field={field} formField={formField} data={data} />;
  }

  if (fieldType === 'switch') {
    return <Switch field={field} formField={formField} data={data} />;
  }

  if (fieldType === 'checkbox') {
    return <Checkbox field={field} formField={formField} data={data} />;
  }

  if (fieldType === 'markdown_editor') {
    return <Markdown field={field} formField={formField} data={data} />;
  }

  if (fieldType === 'upload_image') {
    return (
      <UploadImage
        field={field}
        formField={formField}
        data={data}
        metadata={field.metadata}
      />
    );
  }

  return <Input field={field} formField={formField} data={data} />;
}
