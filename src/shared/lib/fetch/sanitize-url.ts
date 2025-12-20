export function sanitizeUrlForLog(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('blob:')) {
    return 'blob:(local)';
  }

  // Fast path: strip query/hash without parsing.
  const noFragment = trimmed.split('#', 1)[0] || '';
  const noQuery = noFragment.split('?', 1)[0] || '';

  // For relative URLs, we can only log the path safely.
  if (noQuery.startsWith('/')) return noQuery;

  try {
    const url = new URL(trimmed);
    return `${url.origin}${url.pathname}`;
  } catch {
    // Fall back to stripped string with a conservative length cap.
    return noQuery.slice(0, 200);
  }
}
