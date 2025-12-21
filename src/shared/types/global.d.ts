export {};

declare global {
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
