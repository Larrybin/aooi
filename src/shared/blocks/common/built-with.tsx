'use client';

import Link from 'next/link';

import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { isConfigTrue } from '@/shared/lib/general-ui.client';

export function BuiltWith() {
  const { configs } = useAppContext();
  if (!isConfigTrue(configs, 'general_built_with_enabled')) {
    return null;
  }

  return (
    <Button asChild variant="outline" size="sm" className="hover:bg-primary/10">
      <Link href="https://shipany.ai" target="_blank">
        Built with ❤️ ShipAny
      </Link>
    </Button>
  );
}
