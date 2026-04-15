export function trimMapOverflow<K, V>(
  map: Map<K, V>,
  maxEntries: number
): void {
  const overflow = map.size - maxEntries;
  if (overflow <= 0) return;

  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function cleanupExpiringMap<K, V>({
  map,
  now,
  ttlMs,
  maxEntries,
  getTimestamp,
}: {
  map: Map<K, V>;
  now: number;
  ttlMs: number;
  maxEntries: number;
  getTimestamp: (entry: V, key: K) => number;
}): void {
  for (const [key, entry] of map.entries()) {
    if (now - getTimestamp(entry, key) > ttlMs) {
      map.delete(key);
    }
  }

  trimMapOverflow(map, maxEntries);
}
