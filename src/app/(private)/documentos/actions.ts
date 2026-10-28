"use server";
import { withLease } from "@/services/leases";
import { consume } from "@/services/limits";
import { createHash } from "node:crypto";
import { get, del } from "@vercel/blob";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { owner } from "@/lib/owner";
import { db } from "@/db";
import { documents, documentChunks, aiConversations } from "@/db/schema";
import { extract, chunks, maxFileSize } from "@/services/documents";
import { readLimited } from "@/services/http";
async function processUnlocked(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  const database = db();
  const [doc] = await database
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  if (!doc) throw Error("Documento não encontrado.");
  if (doc.status === "ready") return { message: "Documento já processado." };
  try {
    const blob = await get(doc.pathname, {
      access: "private",
      useCache: false,
    });
    if (!blob || blob.statusCode !== 200)
      throw Error("Arquivo ainda não disponível. Tente processar novamente.");
    if (blob.blob.size > maxFileSize) throw Error("Arquivo excede 20 MB.");
    const bytes = await readLimited(new Response(blob.stream), maxFileSize);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const [duplicate] = await database
      .select()
      .from(documents)
      .where(and(eq(documents.userId, user.id), eq(documents.hash, hash)));
    if (duplicate && duplicate.id !== id) {
      await del(doc.pathname);
      await database.delete(documents).where(eq(documents.id, id));
      revalidatePath("/documentos");
      revalidatePath("/biblioteca");
      return {
        message: "Arquivo duplicado removido; documento existente preservado.",
      };
    }
    const content = await extract(doc.name, bytes);
    const parts = chunks(content.sections);
    await database.batch([
      database.delete(documentChunks).where(eq(documentChunks.documentId, id)),
      database
        .insert(documentChunks)
        .values(
          parts.map((c, i) => ({
            documentId: id,
            ordinal: i,
            location: c.location,
            content: c.text,
          })),
        ),
      database
        .update(documents)
        .set({
          hash,
          status: "ready",
          error: null,
          size: bytes.length,
          title: content.title ?? doc.name,
          author: content.author ?? null,
        })
        .where(eq(documents.id, id)),
    ]);
    revalidatePath("/documentos");
    revalidatePath("/biblioteca");
    return { message: `Processado: ${parts.length} trechos com referências.` };
  } catch (e) {
    const message =
      e instanceof Error && e.message.length < 200
        ? e.message
        : "Falha de processamento; verifique arquivo e integração.";
    await database
      .update(documents)
      .set({ status: "error", error: message })
      .where(eq(documents.id, id));
    return { message };
  }
}
async function deleteUnlocked(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  const [doc] = await db()
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  if (!doc) return;
  await db()
    .delete(aiConversations)
    .where(
      and(
        eq(aiConversations.userId, user.id),
        sql`${aiConversations.documentIds} @> ${JSON.stringify([id])}::jsonb`,
      ),
    );
  await db()
    .update(documents)
    .set({ status: "deleting" })
    .where(eq(documents.id, id));
  await del(doc.pathname);
  await db().delete(documents).where(eq(documents.id, id));
  revalidatePath("/documentos");
  revalidatePath("/biblioteca");
}

export async function processDocument(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  await consume(`process:${user.id}`, 1, 10, 60_000);
  return withLease(`document:${id}`, 120000, () => processUnlocked(id));
}

export async function deleteDocument(id: string) {
  await owner();
  z.string().uuid().parse(id);
  return withLease(`document:${id}`, 120000, () => deleteUnlocked(id));
}
