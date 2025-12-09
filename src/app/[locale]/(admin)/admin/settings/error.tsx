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
      <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        <p className="font-semibold">{t('edit.errors.global_title')}</p>
        <p className="mt-1 text-xs text-destructive/80">
          {t('edit.errors.global_desc')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex w-fit items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {t('edit.errors.retry')}
      </button>
    </div>
  );
}

