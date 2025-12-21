'use client';

import { ReactNode } from 'react';
import { CopyIcon } from 'lucide-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { toast } from 'sonner';

export function Copy({
  value,
  placeholder: _placeholder,
  metadata,
  className,
  children,
}: {
  value: string;
  placeholder?: string;
  metadata?: {
    message?: string;
  };
  className?: string;
  children: ReactNode;
}) {
  return (
    <CopyToClipboard
      text={value}
      onCopy={() => toast.success(metadata?.message ?? 'Copied')}
    >
      <div className={`flex cursor-pointer items-center gap-2 ${className}`}>
        {children}
        <CopyIcon className="h-3 w-3" />
      </div>
    </CopyToClipboard>
  );
}
