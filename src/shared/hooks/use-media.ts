'use client';

import { useSyncExternalStore } from 'react';

import { listenEvent } from '@/shared/lib/dom/event-listener';

export function useMedia(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const matchMedia = window.matchMedia(query);
      const handleChange = () => onStoreChange();

      return listenEvent(matchMedia, 'change', handleChange);
    },
    () =>
      typeof window === 'undefined'
        ? defaultValue
        : window.matchMedia(query).matches,
    () => defaultValue
  );
}
