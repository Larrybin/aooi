'use client';

import Image, { type ImageProps } from 'next/image';
import { site } from '@/site';

import { resolveImageSourceStrategy } from '@/shared/config/image-policy.mjs';
import { cn } from '@/shared/lib/utils';

type AppImageCommonProps = {
  src: string;
  alt: string;
  className?: string;
  style?: ImageProps['style'];
  priority?: boolean;
  fetchPriority?: ImageProps['fetchPriority'];
  quality?: ImageProps['quality'];
  loading?: ImageProps['loading'];
  placeholder?: ImageProps['placeholder'];
  blurDataURL?: ImageProps['blurDataURL'];
  title?: string;
  sizes?: string;
};

type AppImageFixedProps = {
  width: number;
  height: number;
  fill?: never;
};

type AppImageFillProps = {
  fill: true;
  sizes: string;
  width?: never;
  height?: never;
};

export type AppImageProps = AppImageCommonProps &
  (AppImageFixedProps | AppImageFillProps);

export function AppImage({ src, alt, className, ...props }: AppImageProps) {
  const strategy = resolveImageSourceStrategy(src, {
    appOrigin: site.brand.appUrl,
  });

  if (strategy.kind === 'empty') {
    return null;
  }

  if (strategy.kind === 'next-image') {
    return (
      <Image
        src={strategy.resolvedSrc}
        alt={alt}
        className={className}
        {...props}
      />
    );
  }

  const imgProps =
    'fill' in props && props.fill
      ? {
          sizes: props.sizes,
        }
      : {
          width: props.width,
          height: props.height,
        };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={strategy.resolvedSrc}
      alt={alt}
      title={props.title}
      className={cn(className, 'object-cover')}
      style={props.style}
      loading={props.loading}
      fetchPriority={props.fetchPriority}
      {...imgProps}
    />
  );
}
