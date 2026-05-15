import * as React from 'react';

import { listenEvent } from '@/shared/lib/dom/event-listener';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      return listenEvent(mql, 'change', onStoreChange);
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  );
}
