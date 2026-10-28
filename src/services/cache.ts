export interface CacheStore {
  runExclusive?<T>(key: string, work: () => Promise<T>): Promise<T>;
  get(key: string): Promise<{ value: unknown; expiresAt: Date } | undefined>;
  set(key: string, value: unknown, expiresAt: Date): Promise<void>;
}
export function cached<T>(
  store: CacheStore,
  key: string,
  ttl: number,
  load: () => Promise<T>,
  flights: Map<string, Promise<unknown>>,
  now = () => Date.now(),
): Promise<T> {
  const pending = flights.get(key);
  if (pending) return pending as Promise<T>;
  const task = (async () => {
    const hit = await store.get(key);
    if (hit && hit.expiresAt.getTime() > now()) return hit.value as T;
    const refresh = async () => {
      if (store.runExclusive) {
        const second = await store.get(key);
        if (second && second.expiresAt.getTime() > now())
          return second.value as T;
      }
      const value = await load();
      await store.set(key, value, new Date(now() + ttl));
      return value;
    };
    return store.runExclusive ? store.runExclusive(key, refresh) : refresh();
  })();
  flights.set(key, task);
  void task.finally(() => flights.delete(key)).catch(() => {});
  return task;
}
