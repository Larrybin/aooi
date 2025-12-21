import Image, { type ImageProps } from 'next/image';

type LazyImageCommonProps = {
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
  unoptimized?: boolean;
  title?: string;
};

type LazyImageFixedProps = {
  width: number;
  height: number;
  fill?: never;
  sizes?: string;
};

type LazyImageFillProps = {
  fill: true;
  sizes: string;
  width?: never;
  height?: never;
};

export type LazyImageProps = LazyImageCommonProps &
  (LazyImageFixedProps | LazyImageFillProps);

export function LazyImage({ src, alt, ...props }: LazyImageProps) {
  if (!src) {
    return null;
  }

  return <Image src={src} alt={alt} {...props} />;
}
