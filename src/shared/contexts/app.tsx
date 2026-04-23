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

import { getAuthClient } from '@/infra/platform/auth/client';
import type {
  AuthUiRuntimeSettings,
  BillingRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';
import { isPlainObject } from '@/shared/lib/api/client';
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
  uiConfig: PublicUiConfig;
  authSettings: AuthUiRuntimeSettings;
  billingSettings: BillingRuntimeSettings;
}

const noop = () => {};

const EMPTY_PUBLIC_UI_CONFIG: PublicUiConfig = {
  aiEnabled: false,
  blogEnabled: false,
  docsEnabled: false,
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: false,
    promotekitEnabled: false,
  },
};

const EMPTY_AUTH_SETTINGS: AuthUiRuntimeSettings = {
  emailAuthEnabled: true,
  googleAuthEnabled: false,
  googleOneTapEnabled: false,
  googleClientId: '',
  githubAuthEnabled: false,
};

const EMPTY_BILLING_SETTINGS: BillingRuntimeSettings = {
  locale: '',
  defaultLocale: '',
  selectPaymentEnabled: false,
  defaultPaymentProvider: '',
  stripeEnabled: false,
  stripePaymentMethods: '',
  creemEnabled: false,
  creemEnvironment: 'sandbox',
  creemProductIds: '',
  paypalEnabled: false,
  paypalEnvironment: 'sandbox',
};

const defaultContextValue: ContextValue = {
  isShowSignModal: false,
  setIsShowSignModal: noop,
  isShowPaymentModal: false,
  setIsShowPaymentModal: noop,
  uiConfig: EMPTY_PUBLIC_UI_CONFIG,
  authSettings: EMPTY_AUTH_SETTINGS,
  billingSettings: EMPTY_BILLING_SETTINGS,
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
  initialUiConfig,
  initialAuthSettings,
  initialBillingSettings,
}: {
  children: ReactNode;
  initialUiConfig: PublicUiConfig;
  initialAuthSettings: AuthUiRuntimeSettings;
  initialBillingSettings: BillingRuntimeSettings;
}) => {
  const uiConfig = initialUiConfig;
  const authSettings = initialAuthSettings;
  const billingSettings = initialBillingSettings;
  const didToastOneTapError = useRef(false);
  const didShowOneTap = useRef(false);

  const [isShowSignModal, setIsShowSignModal] = useState(false);
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const showOneTap = useCallback(async function (settings: AuthUiRuntimeSettings) {
    try {
      const client = getAuthClient(settings);
      if (!isOneTapCapable(client)) {
        return;
      }
      await client.oneTap({
        callbackURL: '/',
        onPromptNotification: (_notification: unknown) => {},
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
      authSettings.googleAuthEnabled &&
      authSettings.googleClientId &&
      authSettings.googleOneTapEnabled
    ) {
      didShowOneTap.current = true;
      void showOneTap(authSettings);
    }
  }, [authSettings, showOneTap]);

  return (
    <PublicAppContext.Provider
      value={{
        isShowSignModal,
        setIsShowSignModal,
        isShowPaymentModal,
        setIsShowPaymentModal,
        uiConfig,
        authSettings,
        billingSettings,
      }}
    >
      {children}
    </PublicAppContext.Provider>
  );
};
