import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { requirePermission } from '@/shared/services/rbac_guard';
import { Header, Main, MainHeader } from '@/shared/blocks/dashboard';
import { FormCard } from '@/shared/blocks/form';
import { parseFormData } from '@/shared/lib/action/form';
import { requireActionPermission, requireActionUser } from '@/shared/lib/action/guard';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { getUuid } from '@/shared/lib/hash';
import { addPost, NewPost, PostStatus, PostType } from '@/shared/models/post';
import {
  getTaxonomies,
  TaxonomyStatus,
  TaxonomyType,
} from '@/shared/models/taxonomy';
import { AdminPostFormSchema } from '@/shared/schemas/actions/admin-post';
import { Crumb } from '@/shared/types/blocks/common';
import { Form } from '@/shared/types/blocks/form';

export default async function PostAddPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check if user has permission to add posts
  await requirePermission({
    code: PERMISSIONS.POSTS_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.posts');

  const crumbs: Crumb[] = [
    { title: t('add.crumbs.admin'), url: '/admin' },
    { title: t('add.crumbs.posts'), url: '/admin/posts' },
    { title: t('add.crumbs.add'), is_active: true },
  ];

  const categories = await getTaxonomies({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
  });
  const categoriesOptions = [
    ...categories.map((category) => ({
      title: category.title,
      value: category.id,
    })),
  ];

  const form: Form = {
    fields: [
      {
        name: 'slug',
        type: 'text',
        title: t('fields.slug'),
        tip: 'unique slug for the post',
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
      {
        name: 'categories',
        type: 'select',
        title: t('fields.categories'),
        options: categoriesOptions,
      },
      {
        name: 'image',
        type: 'upload_image',
        title: t('fields.image'),
        metadata: {
          max: 1,
        },
      },
      {
        name: 'authorName',
        type: 'text',
        title: t('fields.author_name'),
      },
      {
        name: 'authorImage',
        type: 'upload_image',
        title: t('fields.author_image'),
      },
      {
        name: 'content',
        type: 'markdown_editor',
        title: t('fields.content'),
      },
    ],
    passby: {
      type: 'post',
    },
    data: {},
    submit: {
      button: {
        title: t('add.buttons.submit'),
      },
      handler: async (data, passby) => {
        'use server';

        return withAction(async () => {
          const user = await requireActionUser();
          await requireActionPermission(user.id, PERMISSIONS.POSTS_WRITE);

          const {
            slug,
            title,
            description,
            content,
            categories,
            image,
            authorName,
            authorImage,
          } = parseFormData(data, AdminPostFormSchema, {
            message: 'slug and title are required',
          });

          const newPost: NewPost = {
            id: getUuid(),
            userId: user.id,
            parentId: '', // todo: select parent category
            slug: slug.toLowerCase(),
            type: PostType.ARTICLE,
            title,
            description: description ?? '',
            image: image ?? '',
            content: content ?? '',
            categories: categories ?? '',
            tags: '',
            authorName: authorName ?? '',
            authorImage: authorImage ?? '',
            status: PostStatus.PUBLISHED,
          };

          const result = await addPost(newPost);

          if (!result) {
            throw new Error('add post failed');
          }

          return actionOk('post added', '/admin/posts');
        });
      },
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
