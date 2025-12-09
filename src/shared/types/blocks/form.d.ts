import { Button } from './common';

type ValidationRule = {
  required?: boolean;
  min?: number;
  max?: number;
  message?: string;
  email?: boolean;
};

export interface FormField {
  name?: string;
  title?: string;
  type?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'password'
    | 'select'
    | 'url'
    | 'editor'
    | 'code_editor'
    | 'richtext_editor'
    | 'markdown_editor'
    | 'switch'
    | 'checkbox'
    | 'upload_image';
  placeholder?: string;
  group?: string;
  options?: {
    title: string;
    value: string;
    description?: string | null;
  }[];
  value?: string | number | boolean | string[];
  tip?: string;
  attributes?: Record<string, unknown>;
  validation?: ValidationRule;
  metadata?: Record<string, unknown>;
}

export interface FormSubmit<TPassby = unknown> {
  input?: FormField;
  button?: Button;
  action?: string;
  handler?: (
    data: FormData,
    passby?: TPassby
  ) => Promise<
    | {
        status: 'success' | 'error';
        message: string;
        redirect_url?: string;
      }
    | undefined
    | void
  >;
}

export interface Form<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TPassby = unknown
> {
  title?: string;
  description?: string;
  fields: FormField[];
  data?: TData;
  passby?: TPassby;
  submit?: FormSubmit<TPassby>;
}
