'use client';

import { useCallback, useMemo } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';

import type { FormField } from '@/shared/types/blocks/form';

import { ImageUploader, type ImageUploaderValue } from '../common';

interface UploadImageProps {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: Record<string, unknown>;
  metadata?: {
    max?: number;
    maxSizeMB?: number;
  };
  uploadUrl?: string;
  onUpload?: (files: File[]) => Promise<string[]>;
}

export function UploadImage({
  field,
  formField,
  data: _data,
  metadata,
  uploadUrl: _uploadUrl = '/api/storage/upload-image',
  onUpload: _onUpload,
}: UploadImageProps) {
  const maxImages = metadata?.max || 1;
  const maxSizeMB = metadata?.maxSizeMB || 10;
  const allowMultiple = maxImages > 1;
  const accept =
    typeof field.attributes?.accept === 'string'
      ? field.attributes.accept
      : 'image/*,.ico';

  const previews = useMemo(() => {
    const value = formField.value;
    if (!value) return [];

    let urls: string[] = [];

    if (typeof value === 'string') {
      urls = value.includes(',') ? value.split(',').filter(Boolean) : [value];
    } else if (Array.isArray(value)) {
      urls = value;
    }

    return urls;
  }, [formField.value]);

  const handleChange = useCallback(
    (items: ImageUploaderValue[]) => {
      const uploadedUrls = items
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      if (uploadedUrls.length > 0) {
        formField.onChange(allowMultiple ? uploadedUrls : uploadedUrls[0]);
      } else {
        formField.onChange(allowMultiple ? [] : '');
      }
    },
    [formField, allowMultiple]
  );

  return (
    <ImageUploader
      allowMultiple={allowMultiple}
      maxImages={maxImages}
      maxSizeMB={maxSizeMB}
      accept={accept}
      emptyHint={field.placeholder}
      defaultPreviews={previews}
      onChange={handleChange}
    />
  );
}
