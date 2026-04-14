'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';

type AuthSnapshotContextValue = {
  snapshot: AuthSessionUserSnapshot | null;
};

const AuthSnapshotContext = createContext<AuthSnapshotContextValue | null>(null);

export function AuthSnapshotProvider({
  children,
  initialSnapshot,
}: {
  children: ReactNode;
  initialSnapshot: AuthSessionUserSnapshot | null;
}) {
  return (
    <AuthSnapshotContext.Provider value={{ snapshot: initialSnapshot }}>
      {children}
    </AuthSnapshotContext.Provider>
  );
}

export function useAuthSnapshot(): AuthSessionUserSnapshot | null {
  return useContext(AuthSnapshotContext)?.snapshot ?? null;
}
