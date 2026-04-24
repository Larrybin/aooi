'use client';

import { useEffect, useState } from 'react';

export type AIGenerationTaskPhase =
  | 'idle'
  | 'polling'
  | 'success'
  | 'failed'
  | 'timeout';

export type AIGenerationTaskTickResult = {
  done: boolean;
  terminalState?: Exclude<
    AIGenerationTaskPhase,
    'idle' | 'polling' | 'timeout'
  >;
};

export function hasTaskTimedOut({
  startedAt,
  now,
  timeoutMs,
}: {
  startedAt: number;
  now: number;
  timeoutMs: number;
}): boolean {
  return now - startedAt > timeoutMs;
}

export function shouldSkipTaskPoll({
  taskId,
  cancelled,
  inFlight,
}: {
  taskId: string | null;
  cancelled: boolean;
  inFlight: boolean;
}): boolean {
  return !taskId || cancelled || inFlight;
}

type UseAIGenerationTaskOptions = {
  taskId: string | null;
  enabled: boolean;
  pollIntervalMs: number;
  timeoutMs: number;
  onPoll: (taskId: string) => Promise<AIGenerationTaskTickResult>;
  onTimeout: () => void;
};

/**
 * AI generation task state machine
 *
 * [Generate Request]
 *    -> [Credits Gate]
 *    -> [Create Task]
 *    -> [Polling State Machine]
 *    -> [Success/Failed Terminal]
 *    -> [Refresh Credits + UI Terminal State]
 */
export function useAIGenerationTask({
  taskId,
  enabled,
  pollIntervalMs,
  timeoutMs,
  onPoll,
  onTimeout,
}: UseAIGenerationTaskOptions) {
  const [phase, setPhase] = useState<AIGenerationTaskPhase>('idle');

  useEffect(() => {
    if (!enabled || !taskId) {
      setPhase('idle');
      return;
    }

    setPhase('polling');
    const startedAt = Date.now();
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (
        shouldSkipTaskPoll({
          taskId,
          cancelled,
          inFlight,
        })
      ) {
        return;
      }

      const timedOut = hasTaskTimedOut({
        startedAt,
        now: Date.now(),
        timeoutMs,
      });
      if (timedOut) {
        cancelled = true;
        setPhase('timeout');
        onTimeout();
        return;
      }

      inFlight = true;
      try {
        const result = await onPoll(taskId);
        if (!result.done) {
          return;
        }

        cancelled = true;
        setPhase(result.terminalState || 'success');
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, onPoll, onTimeout, pollIntervalMs, taskId, timeoutMs]);

  return {
    phase,
    isPolling: phase === 'polling',
  };
}
