"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { owner } from "@/lib/owner";
import { indexDocument, askDocuments } from "@/services/ai-server";
export async function indexForAi(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  return indexDocument(user.id, id);
}
export async function ask(raw: unknown) {
  const user = await owner();
  const input = z
    .object({
      ids: z.array(z.string().uuid()).min(1).max(5),
      question: z.string().min(3).max(1500),
      deep: z.boolean(),
    })
    .parse(raw);
  const result = await askDocuments(
    user.id,
    [...new Set(input.ids)],
    input.question,
    input.deep,
  );
  revalidatePath("/assistente");
  return result;
}

export async function saveReport(id: string, text: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  z.string().max(30000).parse(text);
  const { db } = await import("@/db");
  const { aiConversations } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  await db()
    .update(aiConversations)
    .set({ reportDraft: text })
    .where(
      and(eq(aiConversations.id, id), eq(aiConversations.userId, user.id)),
    );
  revalidatePath("/assistente");
  return {
    message: "Relatório editado salvo. A resposta original foi preservada.",
  };
}
