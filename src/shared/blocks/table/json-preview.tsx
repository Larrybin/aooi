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

  let parsed: unknown = null;

  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = null;
  }

  if (parsed !== null) {
    return <pre className={className}>{JSON.stringify(parsed, null, 2)}</pre>;
  }

  return <div className={className}>{value}</div>;
}
