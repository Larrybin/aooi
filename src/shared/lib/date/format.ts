function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDatePattern(
  value: string | Date,
  pattern: string
): string {
  const date = toDate(value);
  if (!date) return '';

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    DD: pad2(date.getDate()),
    HH: pad2(date.getHours()),
    mm: pad2(date.getMinutes()),
    ss: pad2(date.getSeconds()),
  };

  return pattern.replace(
    /YYYY|MM|DD|HH|mm|ss/g,
    (token) => tokens[token] ?? ''
  );
}

export function formatRelativeTime(
  value: string | Date,
  options: { locale: string; now?: Date }
): string {
  const date = toDate(value);
  if (!date) return '';

  const now = options.now ?? new Date();
  const diffSeconds = (date.getTime() - now.getTime()) / 1000;

  const rtf = new Intl.RelativeTimeFormat(options.locale, { numeric: 'auto' });

  const abs = Math.abs(diffSeconds);
  if (abs < 60) return rtf.format(Math.round(diffSeconds), 'second');

  const diffMinutes = diffSeconds / 60;
  if (Math.abs(diffMinutes) < 60)
    return rtf.format(Math.round(diffMinutes), 'minute');

  const diffHours = diffMinutes / 60;
  if (Math.abs(diffHours) < 24)
    return rtf.format(Math.round(diffHours), 'hour');

  const diffDays = diffHours / 24;
  if (Math.abs(diffDays) < 30) return rtf.format(Math.round(diffDays), 'day');

  const diffMonths = diffDays / 30;
  if (Math.abs(diffMonths) < 12)
    return rtf.format(Math.round(diffMonths), 'month');

  const diffYears = diffMonths / 12;
  return rtf.format(Math.round(diffYears), 'year');
}
