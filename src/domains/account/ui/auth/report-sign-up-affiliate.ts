type AffiliateWindow = Pick<Window, 'Affonso' | 'promotekit'>;

export function reportSignUpAffiliate({
  configs,
  userEmail,
  stripeCustomerId,
  win = typeof window !== 'undefined' ? window : undefined,
}: {
  configs: Record<string, string>;
  userEmail: string;
  stripeCustomerId?: string;
  win?: AffiliateWindow;
}) {
  if (!userEmail || !win) {
    return;
  }

  if (configs.affonso_enabled === 'true') {
    win.Affonso?.signup(userEmail);
  }

  if (configs.promotekit_enabled === 'true') {
    win.promotekit?.refer(userEmail, stripeCustomerId);
  }
}
