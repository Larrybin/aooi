import { safeJsonParse } from '@/shared/lib/json';

export function JsonPreview({
  value,
  placeholder,
  metadata: _metadata,
  className,
}: {
  value: string;
  placeholder?: string;
  metadata?: Record<string, unknown>;
  className?: string;
}) {
  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  if (typeof value !== 'string') {
    return <div className={className}>{value}</div>;
  }

  const parsed = safeJsonParse<unknown>(value);

  if (parsed !== null) {
    return <pre className={className}>{JSON.stringify(parsed, null, 2)}</pre>;
  }

  return <div className={className}>{value}</div>;
}
