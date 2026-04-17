export async function runPhaseSequence({ phases, cleanup }) {
  let phaseError = null;
  let cleanupError = null;

  try {
    for (const phase of phases) {
      try {
        await phase.action();
      } catch (error) {
        const phaseMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`[${phase.label}] ${phaseMessage}`, {
          cause: error instanceof Error ? error : undefined,
        });
      }
    }
  } catch (error) {
    phaseError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (error) {
        cleanupError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  if (phaseError && cleanupError) {
    throw new Error(
      `${phaseError.message}; [cleanup] ${cleanupError.message}`,
      { cause: phaseError }
    );
  }

  if (phaseError) {
    throw phaseError;
  }

  if (cleanupError) {
    throw cleanupError;
  }
}
