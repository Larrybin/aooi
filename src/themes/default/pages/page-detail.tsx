import { Post as PostType } from '@/shared/types/blocks/blog';
import { PageDetail } from '@/themes/default/blocks/page-detail';

export default async function PageDetailPage({
  locale: _locale,
  post,
}: {
  locale?: string;
  post: PostType;
}) {
  return <PageDetail post={post} />;
}
