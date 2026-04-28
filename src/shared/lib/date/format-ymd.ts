type DateInput = Date | string | number | null | undefined;

function normalizeDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatYmd(input: DateInput): string {
  const date = normalizeDate(input);
  if (!date) {
    return '-';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
