type AffiliateWindow = Pick<Window, 'Affonso' | 'promotekit'>;
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

export function reportSignUpAffiliate({
  uiConfig,
  userEmail,
  stripeCustomerId,
  win = typeof window !== 'undefined' ? window : undefined,
}: {
  uiConfig: PublicUiConfig;
  userEmail: string;
  stripeCustomerId?: string;
  win?: AffiliateWindow;
}) {
  if (!userEmail || !win) {
    return;
  }

  if (uiConfig.affiliate.affonsoEnabled) {
    win.Affonso?.signup(userEmail);
  }

  if (uiConfig.affiliate.promotekitEnabled) {
    win.promotekit?.refer(userEmail, stripeCustomerId);
  }
}
