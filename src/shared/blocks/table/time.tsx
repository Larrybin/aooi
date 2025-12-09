import moment from 'moment';
import { useLocale } from 'next-intl';

export function Time({
  value,
  placeholder,
  metadata,
  className,
}: {
  value: string | Date;
  placeholder?: string;
  metadata?: {
    format?: string;
  };
  className?: string;
}) {
  const intlLocale = useLocale();
  const locale = intlLocale === 'zh' ? 'zh-cn' : intlLocale;

  if (!value) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    return null;
  }

  return (
    <div className={className}>
      {metadata?.format
        ? moment(value).locale(locale).format(metadata?.format)
        : moment(value).locale(locale).fromNow()}
    </div>
  );
}
