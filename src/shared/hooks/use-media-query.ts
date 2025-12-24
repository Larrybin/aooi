import { useEffect, useState } from 'react';

import { listenEvent } from '@/shared/lib/dom/event-listener';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    const handleChange: EventListener = (event) => {
      setMatches((event as MediaQueryListEvent).matches);
    };

    return listenEvent(mediaQuery, 'change', handleChange);
  }, [query]);

  return matches;
}
