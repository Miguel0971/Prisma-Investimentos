"use server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { owner } from "@/lib/owner";
import { db } from "@/db";
import { syncSources } from "@/db/schema";
import { jobPayload } from "@/services/jobs";
import { scheduleSources, runNext } from "@/services/jobs-server";
export async function addSource(raw: unknown) {
  const user = await owner();
  const payload = jobPayload.parse(raw);
  const sources = await db()
    .select()
    .from(syncSources)
    .where(eq(syncSources.userId, user.id));
  if (sources.length >= 20) throw Error("Limite de 20 fontes.");
  await db()
    .insert(syncSources)
    .values({
      userId: user.id,
      key: `${user.id}:${JSON.stringify(payload)}`,
      kind: payload.kind,
      payload,
    })
    .onConflictDoNothing();
  revalidatePath("/configuracoes");
}
export async function removeSource(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  await db()
    .delete(syncSources)
    .where(and(eq(syncSources.id, id), eq(syncSources.userId, user.id)));
  revalidatePath("/configuracoes");
}
export async function syncNext() {
  const user = await owner();
  await scheduleSources(user.id);
  const result = await runNext(user.id);
  revalidatePath("/configuracoes");
  return result;
}
