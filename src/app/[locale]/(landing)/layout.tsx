// data: none
// cache: default
// reason: segment boundary only; avoid adding request-bound logic here
import type { ReactNode } from 'react';

export default function LandingRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
