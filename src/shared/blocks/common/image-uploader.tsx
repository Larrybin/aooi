'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { IconUpload, IconX } from '@tabler/icons-react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { fetchApiData, isPlainObject } from '@/shared/lib/api/client';
import { toastFetchError } from '@/shared/lib/api/fetch-json';
import { cn } from '@/shared/lib/utils';

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderValue {
  id: string;
  preview: string;
  url?: string;
  status: UploadStatus;
  size?: number;
}

interface ImageUploaderProps {
  allowMultiple?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  title?: string;
  emptyHint?: string;
  className?: string;
  defaultPreviews?: string[];
  onChange?: (items: ImageUploaderValue[]) => void;
}

interface UploadItem extends ImageUploaderValue {
  file?: File;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};

const uploadImageFile = async (file: File) => {
  const formData = new FormData();
  formData.append('files', file);

  const data = await fetchApiData<{ urls: string[] }>(
    '/api/storage/upload-image',
    { method: 'POST', body: formData },
    {
      validate: (value): value is { urls: string[] } =>
        isPlainObject(value) &&
        Array.isArray((value as { urls?: unknown }).urls) &&
        typeof (value as { urls: unknown[] }).urls[0] === 'string',
      invalidDataMessage: 'invalid upload response',
    }
  );

  return data.urls[0].trim();
};

export function ImageUploader({
  allowMultiple = false,
  maxImages = 1,
  maxSizeMB = 10,
  title,
  emptyHint,
  className,
  defaultPreviews,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const isInternalChangeRef = useRef(false);
  const itemsRef = useRef<UploadItem[]>([]);

  // 使用 defaultPreviews 初始化 items，只在组件挂载时执行一次
  const [items, setItems] = useState<UploadItem[]>(() => {
    if (defaultPreviews?.length) {
      return defaultPreviews.map((url, index) => ({
        id: `preset-${url}-${index}`,
        preview: url,
        url,
        status: 'uploaded' as UploadStatus,
      }));
    }
    return [];
  });

  const maxCount = allowMultiple ? maxImages : 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  // 保持最新 items 引用（用于卸载时清理 blob URL）
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // 更新 onChange ref
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 同步 defaultPreviews 的变化（只在外部变化时同步，避免循环）
  useEffect(() => {
    // 跳过初始化
    if (!isInitializedRef.current) {
      return;
    }

    // 如果是内部变化触发的，跳过
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const defaultUrls = defaultPreviews || [];

    // 使用函数式更新来访问最新的 items
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems((currentItems) => {
      const currentUrls = currentItems
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      // 比较当前 items 和 defaultPreviews 是否一致
      const isSame =
        defaultUrls.length === currentUrls.length &&
        defaultUrls.every((url, index) => url === currentUrls[index]);

      // 只有当不一致时才返回新的 items
      if (!isSame) {
        // defaultPreviews 覆盖时：回收即将被替换的 blob URL，避免泄漏
        currentItems.forEach((item) => {
          if (item.preview.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
          }
        });

        return defaultUrls.map((url, index) => ({
          id: `preset-${url}-${index}`,
          preview: url,
          url,
          status: 'uploaded' as UploadStatus,
        }));
      }

      return currentItems;
    });
  }, [defaultPreviews]);

  // 保底清理：组件卸载时回收仍存活的 blob URL
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, []);

  // 当 items 变化时触发 onChange，但跳过初始化时的调用
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    // 标记这是内部变化
    isInternalChangeRef.current = true;

    onChangeRef.current?.(
      items.map(({ id, preview, url, status, size }) => ({
        id,
        preview,
        url,
        status,
        size,
      }))
    );
  }, [items]);

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) {
      return;
    }

    const availableSlots = maxCount - items.length;
    if (availableSlots <= 0) {
      toast.error('Maximum number of images reached');
      return;
    }

    const filesToAdd = selectedFiles.slice(0, availableSlots).filter((file) => {
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" exceeds the ${maxSizeMB}MB limit`);
        return false;
      }
      return true;
    });

    if (!filesToAdd.length) {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      return;
    }

    const newItems = filesToAdd.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      preview: URL.createObjectURL(file),
      file,
      size: file.size,
      status: 'uploading' as UploadStatus,
    }));

    setItems((prev) => [...prev, ...newItems]);

    // Upload in parallel
    Promise.all(
      newItems.map(async (item) => {
        try {
          const url = await uploadImageFile(item.file as File);
          setItems((prev) => {
            const next = prev.map((current) => {
              if (current.id === item.id) {
                // Revoke the blob URL since we have the uploaded URL now
                if (current.preview.startsWith('blob:')) {
                  URL.revokeObjectURL(current.preview);
                }
                return {
                  ...current,
                  preview: url, // Replace preview with uploaded URL
                  url,
                  status: 'uploaded' as UploadStatus,
                  file: undefined,
                };
              }
              return current;
            });
            return next;
          });
        } catch (error: unknown) {
          console.error('Upload failed:', error);
          toastFetchError(
            error,
            error instanceof Error && error.message
              ? `Upload failed: ${error.message}`
              : 'Upload failed'
          );
          setItems((prev) => {
            const next = prev.map((current) =>
              current.id === item.id
                ? { ...current, status: 'error' as UploadStatus }
                : current
            );
            return next;
          });
        }
      })
    );

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const countLabel = useMemo(
    () => `${items.length}/${maxCount}`,
    [items.length, maxCount]
  );

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleSelect}
        className="hidden"
      />

      {title && (
        <div className="text-foreground flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>{title}</span>
            <span className="text-primary text-xs">({countLabel})</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap gap-4',
          allowMultiple ? 'flex-wrap' : 'flex-nowrap'
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border p-1 shadow-sm transition"
          >
            <div className="relative overflow-hidden rounded-lg">
              <Image
                src={item.preview}
                alt="Reference"
                className="h-32 w-32 rounded-lg object-cover"
                width={128}
                height={128}
              />
              {item.size && (
                <span className="bg-background text-muted-foreground absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium">
                  {formatBytes(item.size)}
                </span>
              )}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                  Uploading...
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white">
                  Failed
                </div>
              )}
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => handleRemove(item.id)}
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {items.length < maxCount && (
          <div className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border border-dashed p-1 shadow-sm transition">
            <div className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                className="flex h-32 w-32 flex-col items-center justify-center gap-2"
                onClick={openFilePicker}
              >
                <div className="border-border flex h-10 w-10 items-center justify-center rounded-full border border-dashed">
                  <IconUpload className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">Upload</span>
                <span className="text-primary text-xs">Max {maxSizeMB}MB</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!title && (
        <div className="text-muted-foreground text-xs">{emptyHint}</div>
      )}
    </div>
  );
}
