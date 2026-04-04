import { cn } from '@/shared/lib/utils';

type BrandImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  title?: string;
};

export function BrandImage({
  src,
  alt,
  width,
  height,
  className,
  title,
}: BrandImageProps) {
  if (!src) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      title={title}
      className={cn(className)}
    />
  );
}
