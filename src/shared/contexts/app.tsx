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

import { getAuthClient, useSession } from '@/core/auth/client';
import { fetchApiData, isPlainObject } from '@/shared/lib/api/client';
import { toastFetchError } from '@/shared/lib/api/fetch-json';
import type { User } from '@/shared/models/user';

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
  user: User | null;
  isCheckSign: boolean;
  isShowSignModal: boolean;
  setIsShowSignModal: (show: boolean) => void;
  isShowPaymentModal: boolean;
  setIsShowPaymentModal: (show: boolean) => void;
  configs: Record<string, string>;
  fetchUserCredits: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultContextValue: ContextValue = {
  user: null,
  isCheckSign: false,
  isShowSignModal: false,
  setIsShowSignModal: noop,
  isShowPaymentModal: false,
  setIsShowPaymentModal: noop,
  configs: {},
  fetchUserCredits: noopAsync,
  fetchUserInfo: noopAsync,
};

const AppContext = createContext<ContextValue>(defaultContextValue);

export const useAppContext = () => useContext(AppContext);

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

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const didToastConfigsError = useRef(false);
  const didToastUserInfoError = useRef(false);
  const didToastUserCreditsError = useRef(false);
  const didToastOneTapError = useRef(false);
  const didShowOneTap = useRef(false);

  // sign user
  const [user, setUser] = useState<User | null>(null);

  // session
  const { data: session, isPending } = useSession();

  // is check sign: keep SSR/CSR initial render identical, then sync with auth session pending state.
  const [isCheckSign, setIsCheckSign] = useState(true);

  // show sign modal
  const [isShowSignModal, setIsShowSignModal] = useState(false);

  // show payment modal
  const [isShowPaymentModal, setIsShowPaymentModal] = useState(false);

  const fetchConfigs = async function () {
    try {
      const data = await fetchApiData<Record<string, string>>(
        '/api/config/get-configs',
        {
          method: 'POST',
        },
        {
          validate: (value): value is Record<string, string> =>
            isPlainObject(value),
          invalidDataMessage: 'invalid configs response',
        }
      );

      setConfigs(data);
    } catch (e) {
      if (!didToastConfigsError.current) {
        didToastConfigsError.current = true;
        toastFetchError(e, 'Failed to load configs');
      }
    }
  };

  const fetchUserCredits = async function () {
    try {
      if (!user) {
        return;
      }

      const credits = await fetchApiData<User['credits']>(
        '/api/user/get-user-credits',
        {
          method: 'POST',
        },
        {
          validate: (value): value is User['credits'] => isPlainObject(value),
          invalidDataMessage: 'invalid user credits response',
        }
      );

      setUser({ ...user, credits: credits || undefined });
    } catch (e) {
      if (!didToastUserCreditsError.current) {
        didToastUserCreditsError.current = true;
        toastFetchError(e, 'Failed to load user credits');
      }
    }
  };

  const fetchUserInfo = async function () {
    try {
      const data = await fetchApiData<User>('/api/user/get-user-info', {
        method: 'POST',
      });

      setUser(data);
    } catch (e) {
      if (!didToastUserInfoError.current) {
        didToastUserInfoError.current = true;
        toastFetchError(e, 'Failed to load user info');
      }
    }
  };

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
    fetchConfigs();
  }, []);

  useEffect(() => {
    if (session && session.user) {
      setUser(session.user as User);
      fetchUserInfo();
    } else {
      setUser(null);
    }
  }, [session]);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location?.pathname &&
      !window.location.pathname.replace(/\/$/, '').endsWith('/sign-in')
    ) {
      return;
    }

    if (didShowOneTap.current) {
      return;
    }

    if (
      configs &&
      configs.google_auth_enabled === 'true' &&
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true' &&
      !session &&
      !isPending
    ) {
      didShowOneTap.current = true;
      showOneTap(configs);
    }
  }, [configs, session, isPending, showOneTap]);

  useEffect(() => {
    if (user && !user.credits) {
      // fetchUserCredits();
    }
  }, [user]);

  useEffect(() => {
    setIsCheckSign(isPending);
  }, [isPending]);

  return (
    <AppContext.Provider
      value={{
        user,
        isCheckSign,
        isShowSignModal,
        setIsShowSignModal,
        isShowPaymentModal,
        setIsShowPaymentModal,
        configs,
        fetchUserCredits,
        fetchUserInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
