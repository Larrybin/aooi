'use client';

import {
  createContext,
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

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const didToastConfigsError = useRef(false);
  const didToastUserInfoError = useRef(false);
  const didToastUserCreditsError = useRef(false);
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
      console.log('fetch configs failed:', e);
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
      console.log('fetch user credits failed:', e);
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
      console.log('fetch user info failed:', e);
    }
  };

  const showOneTap = async function (configs: Record<string, string>) {
    try {
      const client = getAuthClient(configs) as unknown as OneTapCapable;
      await client.oneTap({
        callbackURL: '/',
        onPromptNotification: (notification: unknown) => {
          // Handle prompt dismissal silently
          // This callback is triggered when the prompt is dismissed or skipped
          console.log('One Tap prompt notification:', notification);
        },
        // fetchOptions: {
        //   onSuccess: () => {
        //     router.push('/');
        //   },
        // },
      });
    } catch {
      // Silently handle One Tap cancellation errors
      // These errors occur when users close the prompt or decline to sign in
      // Common errors: FedCM NetworkError, AbortError, etc.
    }
  };

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
      configs.google_client_id &&
      configs.google_one_tap_enabled === 'true' &&
      !session &&
      !isPending
    ) {
      didShowOneTap.current = true;
      showOneTap(configs);
    }
  }, [configs, session, isPending]);

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
