import { LazyImage } from '@/shared/blocks/common/lazy-image';
import { cn } from '@/shared/lib/utils';

export function Image({
  value,
  metadata,
  placeholder,
  className,
  alt,
}: {
  value: string;
  metadata?: {
    width?: number;
    height?: number;
  };
  placeholder?: string;
  className?: string;
  alt?: string;
}) {
  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  const width = metadata?.width || 40;
  const height = metadata?.height || 40;

  return (
    <LazyImage
      src={value}
      alt={alt ?? placeholder ?? value}
      width={width}
      height={height}
      className={cn('shrink-0 rounded-md object-cover', className)}
    />
  );
}
