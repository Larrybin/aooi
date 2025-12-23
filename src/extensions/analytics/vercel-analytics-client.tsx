'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

type Mode = 'auto' | 'development' | 'production';

const DynamicVercelAnalytics = dynamic(
  () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
  { ssr: false }
);

export function VercelAnalyticsClient({
  mode,
  debug,
}: {
  mode?: Mode;
  debug?: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);

    if (document.readyState === 'complete') {
      const timeoutId = window.setTimeout(enable, 0);
      return () => window.clearTimeout(timeoutId);
    }

    window.addEventListener('load', enable, { once: true });
    return () => window.removeEventListener('load', enable);
  }, []);

  if (!ready) return null;
  return <DynamicVercelAnalytics mode={mode} debug={debug} />;
}
