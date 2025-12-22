'use client';

import dynamic from 'next/dynamic';

const LocaleDetector = dynamic(
  () => import('./locale-detector').then((mod) => mod.LocaleDetector),
  { ssr: false }
);

export function LocaleDetectorLazy() {
  return <LocaleDetector />;
}
