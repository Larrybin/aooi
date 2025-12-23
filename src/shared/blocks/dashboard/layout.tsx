import type { ReactNode } from 'react';

import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import type { Sidebar as SidebarType } from '@/shared/types/blocks/dashboard';

import { Sidebar } from './sidebar';

export function DashboardLayout({
  children,
  sidebar,
  initialUser,
}: {
  children: ReactNode;
  sidebar: SidebarType;
  initialUser?: AuthSessionUserSnapshot | null;
}) {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as React.CSSProperties
      }
    >
      {sidebar && (
        <Sidebar
          variant={sidebar.variant || 'inset'}
          sidebar={sidebar}
          initialUser={initialUser}
        />
      )}
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
