import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
export async function withLease<T>(
  key: string,
  ttl: number,
  work: () => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + ttl);
  const result = await db().execute(
    sql`INSERT INTO lease_locks(key,token,expires_at) VALUES (${key},${token},${expires.toISOString()}::timestamptz) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE lease_locks.expires_at<now() RETURNING token`,
  );
  if (!result.rows.length)
    throw Error(
      "Esta operação já está em andamento. Tente novamente em instantes.",
    );
  try {
    return await work();
  } finally {
    await db().execute(
      sql`DELETE FROM lease_locks WHERE key=${key} AND token=${token}`,
    );
  }
}

export function withLeases<T>(
  keys: string[],
  ttl: number,
  work: () => Promise<T>,
): Promise<T> {
  const ordered = [...new Set(keys)].sort();
  const acquire = (i: number): Promise<T> =>
    i === ordered.length
      ? work()
      : withLease(ordered[i], ttl, () => acquire(i + 1));
  return acquire(0);
}
