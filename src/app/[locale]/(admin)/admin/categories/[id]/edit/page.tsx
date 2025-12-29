// data: admin session (RBAC) + category record (db) + Server Action write
// cache: no-store (request-bound auth/RBAC)
// reason: admin write flow; avoid caching across users/roles
import { getTranslations } from 'next-intl/server';

import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildAdminCrumbs, setupAdminPage } from '@/shared/lib/admin';
import { findTaxonomy } from '@/shared/models/taxonomy';
import type { Form } from '@/shared/types/blocks/form';

import { updateCategoryAction } from '../../actions';

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  await setupAdminPage({
    locale,
    permission: PERMISSIONS.CATEGORIES_WRITE,
  });

  const t = await getTranslations('admin.categories');

  const category = await findTaxonomy({ id });
  if (!category) {
    return <Empty message="Category not found" />;
  }

  const crumbs = buildAdminCrumbs(t, [
    { key: 'edit.crumbs.admin', url: '/admin' },
    { key: 'edit.crumbs.categories', url: '/admin/categories' },
    { key: 'edit.crumbs.edit' },
  ]);

  // Use bind to pass id parameter (Next.js recommended pattern)
  const updateWithId = updateCategoryAction.bind(null, id);

  const form: Form<
    typeof category,
    { type: 'category'; category: typeof category }
  > = {
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
      category: category,
    },
    data: category,
    submit: {
      button: {
        title: t('edit.buttons.submit'),
      },
      handler: updateWithId,
    },
  };

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader title={t('edit.title')} />
        <FormCard form={form} className="md:max-w-xl" />
      </Main>
    </>
  );
}
