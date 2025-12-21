'use server';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { validateAndParseForm } from '@/shared/lib/admin/action-utils';
import { getUuid } from '@/shared/lib/hash';
import {
  addPost,
  findPost,
  NewPost,
  PostStatus,
  PostType,
  updatePost,
} from '@/shared/models/post';
import { AdminPostFormSchema } from '@/shared/schemas/actions/admin-post';

/**
 * Create a new post
 */
export async function createPostAction(formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.POSTS_WRITE,
      schema: AdminPostFormSchema,
      errorMessage: 'slug and title are required',
    });

    const newPost: NewPost = {
      id: getUuid(),
      userId: user.id,
      parentId: '',
      slug: data.slug.toLowerCase(),
      type: PostType.ARTICLE,
      title: data.title,
      description: data.description ?? '',
      image: data.image ?? '',
      content: data.content ?? '',
      categories: data.categories ?? '',
      tags: '',
      authorName: data.authorName ?? '',
      authorImage: data.authorImage ?? '',
      status: PostStatus.PUBLISHED,
    };

    const result = await addPost(newPost);
    if (!result) {
      throw new Error('add post failed');
    }

    return actionOk('post added', '/admin/posts');
  });
}

/**
 * Update an existing post
 */
export async function updatePostAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.POSTS_WRITE,
      schema: AdminPostFormSchema,
      errorMessage: 'slug and title are required',
    });

    const post = await findPost({ id });
    if (!post) {
      throw new Error('Post not found');
    }

    const result = await updatePost(id, {
      parentId: '',
      slug: data.slug.toLowerCase(),
      type: PostType.ARTICLE,
      title: data.title,
      description: data.description ?? '',
      image: data.image ?? '',
      content: data.content ?? '',
      categories: data.categories ?? '',
      tags: '',
      authorName: data.authorName ?? '',
      authorImage: data.authorImage ?? '',
      status: PostStatus.PUBLISHED,
    });

    if (!result) {
      throw new Error('update post failed');
    }

    return actionOk('post updated', '/admin/posts');
  });
}
