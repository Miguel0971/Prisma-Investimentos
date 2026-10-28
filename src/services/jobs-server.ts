import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { syncJobs, syncSources, dataCache } from "@/db/schema";
import { jobPayload, retryDelay, scheduleKey } from "./jobs";
import { BrapiProvider } from "./market";
import { refreshCompanyPackage } from "./cvm-server";
import { indexDocument } from "./ai-server";
import { cacheStore } from "./market-server";
export async function enqueue(
  userId: string,
  raw: unknown,
  day = new Date().toISOString().slice(0, 10),
) {
  const payload = jobPayload.parse(raw);
  await db()
    .insert(syncJobs)
    .values({
      userId,
      key: scheduleKey(userId, payload, day),
      sourceKey: `${userId}:${JSON.stringify(payload)}`,
      kind: payload.kind,
      payload,
    })
    .onConflictDoNothing();
}
export async function scheduleSources(userId: string) {
  const sources = await db()
    .select()
    .from(syncSources)
    .where(eq(syncSources.userId, userId))
    .limit(20);
  for (const source of sources) await enqueue(userId, source.payload);
  return sources.length;
}
export async function runNext(userId: string) {
  const database = db();
  const token = crypto.randomUUID();
  const claimed = await database.execute(
    sql`UPDATE sync_jobs SET status='running',attempts=attempts+1,locked_until=now()+interval '120 seconds',lock_token=${token},updated_at=now() WHERE id=(SELECT id FROM sync_jobs WHERE user_id=${userId} AND attempts<3 AND ((status='queued' AND available_at<=now()) OR (status='running' AND locked_until<now())) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,payload,attempts`,
  );
  const job = claimed.rows[0] as
    { id: string; payload: unknown; attempts: number } | undefined;
  if (!job) return { message: "Nenhum job disponível." };
  try {
    const p = jobPayload.parse(job.payload);
    let result: string;
    if (p.kind === "quote") {
      const quote = await new BrapiProvider(process.env.BRAPI_TOKEN).quote(
        p.ticker,
        "1mo",
      );
      await cacheStore.set(
        `quote:${p.ticker}:1mo`,
        quote,
        new Date(Date.now() + 60_000),
      );
      result = `${p.ticker}: cotação consultada em ${quote.fetchedAt}`;
    } else if (p.kind === "cvm") {
      const report = await refreshCompanyPackage(p.cnpj, p.type, p.year);
      await cacheStore.set(
        `cvm:v2:${p.cnpj}:${p.type}:${p.year}:DRE:con`,
        report,
        new Date(Date.now() + 86400_000),
      );
      result = `${report.docs.length} documentos, ${report.rows.length} linhas. CVM ${report.fetchedAt}`;
    } else result = (await indexDocument(userId, p.documentId)).message;
    await database.execute(
      sql`UPDATE sync_jobs SET status='done',result=${result},locked_until=null,lock_token=null,updated_at=now() WHERE id=${job.id} AND lock_token=${token}`,
    );
    return { message: result };
  } catch {
    const available = new Date(Date.now() + retryDelay(job.attempts));
    await database.execute(
      sql`UPDATE sync_jobs SET status=${job.attempts >= 3 ? "failed" : "queued"},available_at=${available.toISOString()}::timestamptz,locked_until=null,lock_token=null,result='Falha externa ou entrada indisponível; sem dados sensíveis no log.',updated_at=now() WHERE id=${job.id} AND lock_token=${token}`,
    );
    return {
      message:
        "Falha registrada. Retentativa limitada agendada quando aplicável.",
    };
  }
}
export async function cleanupExpired() {
  await db()
    .delete(dataCache)
    .where(sql`${dataCache.expiresAt}<now()-interval '7 days'`);
  await db().execute(
    sql`DELETE FROM request_limits WHERE expires_at<now()-interval '2 days'`,
  );
  await db().execute(
    sql`UPDATE sync_jobs SET status='failed',result='Execução interrompida após limite de tentativas.',locked_until=null WHERE status='running' AND locked_until<now() AND attempts>=3`,
  );
}
