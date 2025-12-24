import { Link } from '@/core/i18n/navigation';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import type { User as UserType } from '@/shared/models/user';

export function User({
  value,
  placeholder,
  metadata: _metadata,
  className,
}: {
  value: UserType;
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

  return (
    <Link
      href={`/changanpenpen/users?email=${value.email}`}
      target="_blank"
      className={cn('flex items-center gap-2', className)}
    >
      <Avatar className={className}>
        <AvatarImage src={value.image || ''} alt={value.name} />
        <AvatarFallback>{value.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">{value.name}</div>
    </Link>
  );
}
