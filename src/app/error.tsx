'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep it minimal: in production Next.js will serialize errors safely.
    console.error('app error boundary', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">页面发生错误</h1>
      <p className="text-muted-foreground text-sm">
        请重试。如果问题持续，请提供 requestId（查看浏览器 Network 响应头
        <code className="mx-1">x-request-id</code>）与下方 digest 以便排查。
      </p>
      {error.digest ? (
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">digest：</span>
          <code>{error.digest}</code>
        </div>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          onClick={reset}
        >
          重试
        </button>
        <Link
          href="/"
          className="border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md border px-4 py-2 text-sm font-medium"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
