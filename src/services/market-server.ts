import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dataCache } from "@/db/schema";
import { withLease } from "./leases";
import { cached, type CacheStore } from "./cache";
import { BrapiProvider, type Range } from "./market";
const flights = new Map<string, Promise<unknown>>();
export const cacheStore: CacheStore = {
  runExclusive: (key, work) => withLease(`cache:${key}`, 60000, work),
  async get(key) {
    const [hit] = await db()
      .select()
      .from(dataCache)
      .where(eq(dataCache.key, key));
    return hit;
  },
  async set(key, value, expiresAt) {
    await db()
      .insert(dataCache)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({ target: dataCache.key, set: { value, expiresAt } });
  },
};
export function marketQuote(ticker: string, range: Range) {
  return cached(
    cacheStore,
    `quote:${ticker}:${range}`,
    60_000,
    () => new BrapiProvider(process.env.BRAPI_TOKEN).quote(ticker, range),
    flights,
  );
}
export function marketSearch(query: string) {
  return cached(
    cacheStore,
    `search:${query.toLowerCase()}`,
    3600_000,
    () => new BrapiProvider(process.env.BRAPI_TOKEN).search(query),
    flights,
  );
}
