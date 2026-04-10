import type { ReactNode } from 'react';

import type { Post as PostType } from '@/shared/types/blocks/blog';

export function resolveBlogDetailPageAds(
  post: PostType,
  {
    inlineAd,
    footerAd,
  }: {
    inlineAd?: ReactNode;
    footerAd?: ReactNode;
  }
) {
  return {
    inlineAd: post.inlineAdContent ? inlineAd : null,
    footerAd,
  };
}
