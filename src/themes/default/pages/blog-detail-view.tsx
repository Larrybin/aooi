import type { ReactNode } from 'react';

import type { Post as PostType } from '@/shared/types/blocks/blog';
import { BlogDetail } from '@/themes/default/blocks/blog-detail';

import { resolveBlogDetailPageAds } from './blog-detail-page-state';

export function BlogDetailPageView({
  post,
  inlineAd,
  footerAd,
}: {
  post: PostType;
  inlineAd?: ReactNode;
  footerAd?: ReactNode;
}) {
  const resolvedAds = resolveBlogDetailPageAds(post, { inlineAd, footerAd });

  return (
    <BlogDetail
      post={post}
      inlineAd={resolvedAds.inlineAd}
      footerAd={resolvedAds.footerAd}
    />
  );
}
