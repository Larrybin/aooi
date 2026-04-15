export type AuthSessionUserIdentity = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type AuthSessionUserSnapshot = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type UserCreditsSummary = {
  remainingCredits: number;
  expiresAt: string | null;
};

export type SelfUserDetails = {
  isAdmin: boolean;
  credits: UserCreditsSummary | null;
  currentSubscriptionProductId: string | null;
};
