import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission } from '@/shared/services/rbac_guard';
import { Empty } from '@/shared/blocks/common';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionPermission, requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import {
  findTaxonomy,
  TaxonomyStatus,
  updateTaxonomy,
  UpdateTaxonomy,
} from '@/shared/models/taxonomy';
import { AdminCategoryFormSchema } from '@/shared/schemas/actions/admin-category';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function CategoryEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Check if user has permission to edit categories
  await requirePermission({
    code: PERMISSIONS.CATEGORIES_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.categories');

  const category = await findTaxonomy({ id });
  if (!category) {
    return <Empty message="Category not found" />;
  }

  const crumbs: Crumb[] = [
    { title: t('edit.crumbs.admin'), url: '/admin' },
    { title: t('edit.crumbs.categories'), url: '/admin/categories' },
    { title: t('edit.crumbs.edit'), is_active: true },
  ];

  const form: Form<typeof category, { type: 'category'; category: typeof category }> = {
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
      handler: async (data, passby) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          await requireActionPermission(user.id, PERMISSIONS.CATEGORIES_WRITE);

          const category = await findTaxonomy({ id });
          if (!category || category.userId !== user.id) {
            throw new Error('access denied');
          }

          const { slug, title, description } = parseFormData(
            data,
            AdminCategoryFormSchema,
            { message: 'slug and title are required' }
          );

          const updateCategory: UpdateTaxonomy = {
            parentId: '', // todo: select parent category
            slug: slug.toLowerCase(),
            title,
            description: description ?? '',
            image: '',
            icon: '',
            status: TaxonomyStatus.PUBLISHED,
          };

          const result = await updateTaxonomy(category.id, updateCategory);

          if (!result) {
            throw new Error('update category failed');
          }

          return actionOk('category updated', '/admin/categories');
        });
      },
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
