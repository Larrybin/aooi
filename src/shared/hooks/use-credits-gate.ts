'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import type { SelfUserDetails } from '@/shared/types/auth-session';

export function hasEnoughCredits(
  details: SelfUserDetails,
  requiredCredits: number
) {
  return (details.credits?.remainingCredits ?? 0) >= requiredCredits;
}

export function useCreditsGate({
  resolveDetails,
}: {
  resolveDetails: () => Promise<SelfUserDetails | null>;
}) {
  const ensureCredits = useCallback(
    async ({
      requiredCredits,
      insufficientCreditsMessage,
    }: {
      requiredCredits: number;
      insufficientCreditsMessage: string;
    }) => {
      const details = await resolveDetails();
      if (!details) {
        return null;
      }

      if (!hasEnoughCredits(details, requiredCredits)) {
        toast.error(insufficientCreditsMessage);
        return null;
      }

      return details;
    },
    [resolveDetails]
  );

  return {
    ensureCredits,
  };
}
