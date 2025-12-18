'use client';

import { useSyncExternalStore } from 'react';

export function useMedia(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const matchMedia = window.matchMedia(query);
      const handleChange = () => onStoreChange();

      matchMedia.addEventListener('change', handleChange);
      return () => matchMedia.removeEventListener('change', handleChange);
    },
    () => (typeof window === 'undefined' ? defaultValue : window.matchMedia(query).matches),
    () => defaultValue
  );
}
