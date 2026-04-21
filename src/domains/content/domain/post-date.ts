import 'server-only';

import moment from 'moment';

export function formatPostDate(createdAt: string, locale?: string) {
  return moment(createdAt)
    .locale(locale || 'en')
    .format(locale === 'zh' ? 'YYYY/MM/DD' : 'MMM D, YYYY');
}
