export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function toErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function toError(
  error: unknown,
  fallbackMessage = 'Unknown error'
): Error {
  if (error instanceof Error) return error;
  const message = toErrorMessage(error);
  return new Error(message || fallbackMessage);
}
