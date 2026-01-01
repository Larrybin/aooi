import 'server-only';

import moment from 'moment';

export function formatPostDate(createdAt: string, locale?: string) {
  // Keep formatting consistent across DB-sourced and local-content posts.
  return moment(createdAt)
    .locale(locale || 'en')
    .format(locale === 'zh' ? 'YYYY/MM/DD' : 'MMM D, YYYY');
}
