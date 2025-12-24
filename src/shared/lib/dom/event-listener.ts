export type ListenEventOptions = AddEventListenerOptions | boolean | undefined;

export function listenEvent(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: ListenEventOptions
): () => void {
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

export function listenEvents(
  entries: Array<{
    target: EventTarget;
    type: string;
    listener: EventListenerOrEventListenerObject;
    options?: ListenEventOptions;
  }>
): () => void {
  const cleanups = entries.map((entry) =>
    listenEvent(entry.target, entry.type, entry.listener, entry.options)
  );
  return () => {
    for (let i = cleanups.length - 1; i >= 0; i -= 1) {
      cleanups[i]?.();
    }
  };
}
