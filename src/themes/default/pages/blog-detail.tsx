import { AdZone } from '@/extensions/ads';
import type { Post as PostType } from '@/shared/types/blocks/blog';
import { BlogDetailPageView } from '@/themes/default/pages/blog-detail-view';

export default async function BlogDetailPage({
  locale: _locale,
  post,
}: {
  locale?: string;
  post: PostType;
}) {
  return (
    <BlogDetailPageView
      post={post}
      inlineAd={<AdZone zone="blog_post_inline" className="my-10 md:my-12" />}
      footerAd={<AdZone zone="blog_post_footer" className="mt-10 md:mt-12" />}
    />
  );
}
