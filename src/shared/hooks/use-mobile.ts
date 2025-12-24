import * as React from 'react';

import { listenEvent } from '@/shared/lib/dom/event-listener';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);
  const [isHydrated, setIsHydrated] = React.useState(false);

  React.useEffect(() => {
    setIsHydrated(true);
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    const cleanup = listenEvent(mql, 'change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return cleanup;
  }, []);

  // During SSR and initial render, always return false to match server output
  if (!isHydrated) {
    return false;
  }

  return isMobile;
}
