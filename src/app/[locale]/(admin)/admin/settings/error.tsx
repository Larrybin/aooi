'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { error, reset } = props;
  const t = useTranslations('admin.settings');

  useEffect(() => {
    console.error('Admin settings segment error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col px-4 py-8 md:px-6">
      <div className="border-destructive bg-destructive/10 text-destructive mb-4 rounded-md border p-4 text-sm">
        <p className="font-semibold">{t('edit.errors.global_title')}</p>
        <p className="text-destructive/80 mt-1 text-xs">
          {t('edit.errors.global_desc')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex w-fit items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
      >
        {t('edit.errors.retry')}
      </button>
    </div>
  );
}
