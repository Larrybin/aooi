export {};

declare global {
  var __NEXT_BASE_PATH__: string;
  var __TRAILING_SLASH__: boolean;

  interface Window {
    Affonso?: {
      signup: (email: string) => void;
    };
    promotekit?: {
      refer: (email: string, stripeCustomerId?: string) => void;
    };
    promotekit_referral?: string;
  }

  interface Navigator {
    userLanguage?: string;
  }
}
