// data: signed-in user (better-auth)
// cache: no-store (request-bound auth)
// reason: user-specific security entry page
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { PanelCard } from '@/shared/blocks/panel';
import { getUserInfo } from '@/shared/models/user';

export default async function SecurityPage() {
  const user = await getUserInfo();
  if (!user) {
    return <Empty message="no auth" />;
  }

  const t = await getTranslations('settings.security');

  return (
    <div className="space-y-8">
      <PanelCard
        title={t('reset_password.title')}
        description={t('reset_password.description')}
        content={t('reset_password.tip')}
        buttons={[
          {
            title: t('reset_password.buttons.submit'),
            url: '/settings/security',
            target: '_self',
            variant: 'default',
            size: 'sm',
            icon: 'RiLockPasswordLine',
          },
        ]}
        className="max-w-md"
      />
      <PanelCard
        title={t('delete_account.title')}
        description={t('delete_account.description')}
        content={t('delete_account.tip')}
        buttons={[
          {
            title: t('delete_account.buttons.submit'),
            url: '/settings/security',
            target: '_self',
            variant: 'destructive',
            size: 'sm',
            icon: 'RiDeleteBinLine',
          },
        ]}
        className="max-w-md"
      />
    </div>
  );
}
