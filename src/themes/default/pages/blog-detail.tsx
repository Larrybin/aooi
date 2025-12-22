import { Post as PostType } from '@/shared/types/blocks/blog';
import { BlogDetail } from '@/themes/default/blocks/blog-detail';

export default async function BlogDetailPage({
  locale: _locale,
  post,
}: {
  locale?: string;
  post: PostType;
}) {
  return <BlogDetail post={post} />;
}
