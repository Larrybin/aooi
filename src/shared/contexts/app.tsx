'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getAuthClient } from '@/core/auth/client';
import { toastFetchError } from '@/shared/lib/api/fetch-json';

type OneTapParams = {
  callbackURL: string;
  onPromptNotification?: (notification: unknown) => void;
  fetchOptions?: Record<string, unknown>;
};

type OneTapCapable = {
  oneTap: (params: OneTapParams) => Promise<unknown>;
};

function isOneTapCapable(value: unknown): value is OneTapCapable {
  return (
    isPlainObject(value) &&
    typeof (value as { oneTap?: unknown }).oneTap === 'function'
  );
}

export interface ContextValue {
  isShowSignModal: boolean;
  setIsShowSignModal: (show: boolean) => void;
  isShowPaymentModal: boolean;
  setIsShowPaymentModal: (show: boolean) => void;
  configs: Record<string, string>;
}

const noop = () => {};

const defaultContextValue: ContextValue = {
  isShowSignModal: false,
  setIsShowSignModal: noop,
  isShowPaymentModal: false,
  setIsShowPaymentModal: noop,
  configs: {},
};

const PublicAppContext = createContext<ContextValue>(defaultContextValue);

export const usePublicAppContext = () => useContext(PublicAppContext);

function isIgnorableOneTapError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === 'AbortError' ||
      error.name === 'NotAllowedError' ||
      error.name === 'NetworkError'
    );
  }

  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    const message = error.message.toLowerCase();

    return (
      name.includes('abort') ||
      name.includes('notallowed') ||
      name.includes('networkerror') ||
      message.includes('abort') ||
      message.includes('cancel') ||
      message.includes('dismiss') ||
      message.includes('declin') ||
      message.includes('not allowed') ||
      message.includes('fedcm') ||
      message.includes('networkerror')
    );
  }

  if (typeof error === 'string') {
    const message = error.toLowerCase();
    return (
      message.includes('abort') ||
      message.includes('cancel') ||
      message.includes('dismiss') ||
      message.includes('not allowed') ||
      message.includes('fedcm')
    );
  }

  return false;
}

export const PublicAppProvider = ({
  children,
  initialConfigs,
}: {
  children: ReactNode;
  initialConfigs: Record<string, string>;
}) => {
  const configs = initialConfigs;
  const didToastOneTapError = useRef(false);
  const didShowOneTap = useRef(false);

  // show sign modal
  const [isShowSignModal, setIsShowSignModal] = useState(false);

  // show payment modal
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const showOneTap = useCallback(async function (
    configs: Record<string, string>
  ) {
    try {
      const client = getAuthClient(configs);
      if (!isOneTapCapable(client)) {
        return;
      }
      await client.oneTap({
        callbackURL: '/',
        onPromptNotification: (_notification: unknown) => {
          // Handle prompt dismissal silently
          // This callback is triggered when the prompt is dismissed or skipped
        },
        // fetchOptions: {
        //   onSuccess: () => {
        //     router.push('/');
        //   },
        // },
      });
    } catch (e: unknown) {
      if (isIgnorableOneTapError(e)) {
        return;
      }

      if (didToastOneTapError.current) {
        return;
      }

      didToastOneTapError.current = true;
      toastFetchError(e, 'One Tap sign-in failed');
    }
  }, []);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.location?.pathname ||
      !window.location.pathname.replace(/\/$/, '').endsWith('/sign-in')
    ) {
      return;
    }

    if (didShowOneTap.current) {
      return;
    }

    if (
      configs.google_auth_enabled === 'true' &&
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true'
    ) {
      didShowOneTap.current = true;
      void showOneTap(configs);
    }
  }, [configs, showOneTap]);

  return (
    <PublicAppContext.Provider
      value={{
        isShowSignModal,
        setIsShowSignModal,
        isShowPaymentModal,
        setIsShowPaymentModal,
        configs,
      }}
    >
      {children}
    </PublicAppContext.Provider>
  );
};
