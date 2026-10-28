import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
export async function consume(
  key: string,
  amount: number,
  limit: number,
  windowMs: number,
) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1
  )
    throw Error("Configuração de limite inválida.");
  const end = new Date(Math.floor(Date.now() / windowMs) * windowMs + windowMs);
  const bucket = `${key}:${end.getTime()}`;
  const r = await db().execute(
    sql`INSERT INTO request_limits(key,count,expires_at) SELECT ${bucket},${amount},${end.toISOString()}::timestamptz WHERE ${amount}::integer <= ${limit}::integer ON CONFLICT(key) DO UPDATE SET count=request_limits.count+${amount} WHERE request_limits.count+${amount} <= ${limit} RETURNING count`,
  );
  if (!r.rows.length)
    throw Error(
      "Limite de uso atingido. Aguarde a próxima janela ou ajuste o orçamento no servidor.",
    );
}
