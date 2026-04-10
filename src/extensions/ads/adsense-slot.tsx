'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdsenseSlot({
  clientId,
  slot,
}: {
  clientId: string;
  slot: string;
}) {
  useEffect(() => {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore third-party script initialization errors so the page stays usable.
    }
  }, [slot]);

  return (
    <ins
      className="adsbygoogle block min-h-[120px] w-full"
      style={{ display: 'block' }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
