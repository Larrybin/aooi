import { getTranslations } from 'next-intl/server';

import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildAdminCrumbs, setupAdminPage } from '@/shared/lib/admin';
import type { Form } from '@/shared/types/blocks/form';

import { createCategoryAction } from '../actions';

export default async function CategoryAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.CATEGORIES_WRITE,
  });

  const t = await getTranslations('admin.categories');

  const crumbs = buildAdminCrumbs(t, [
    { key: 'add.crumbs.admin', url: '/changanpenpen' },
    { key: 'add.crumbs.categories', url: '/changanpenpen/categories' },
    { key: 'add.crumbs.add' },
  ]);

  const form: Form = {
    fields: [
      {
        name: 'slug',
        type: 'text',
        title: t('fields.slug'),
        tip: 'unique slug for the category',
        validation: { required: true },
      },
      {
        name: 'title',
        type: 'text',
        title: t('fields.title'),
        validation: { required: true },
      },
      {
        name: 'description',
        type: 'textarea',
        title: t('fields.description'),
      },
    ],
    passby: {
      type: 'category',
    },
    data: {},
    submit: {
      button: {
        title: t('add.buttons.submit'),
      },
      handler: createCategoryAction,
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('add.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
