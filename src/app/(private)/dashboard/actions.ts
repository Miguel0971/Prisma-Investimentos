"use server";
import { requireOwner } from "@/lib/auth";
import { db } from "@/db";
import { users, watchlists } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { tickerSchema } from "@/lib/policy";
import { revalidatePath } from "next/cache";
import { z } from "zod";
export async function addFavorite(_state: { message: string }, data: FormData) {
  const session = await requireOwner();
  const parsed = tickerSchema.safeParse(data.get("ticker"));
  if (!parsed.success)
    return {
      message: "Ticker inválido. Use quatro letras e um ou dois números.",
    };
  try {
    const database = db();
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.githubId, session.githubId));
    if (!user) return { message: "Usuário não encontrado. Entre novamente." };
    await database
      .insert(watchlists)
      .values({ userId: user.id, ticker: parsed.data })
      .onConflictDoNothing();
    revalidatePath("/dashboard");
    return {
      message:
        "Favorito salvo. Existência do ativo ainda não verificada no fornecedor.",
    };
  } catch {
    return {
      message: "Não foi possível salvar. Verifique a conexão com o banco.",
    };
  }
}
export async function removeFavorite(data: FormData) {
  const session = await requireOwner();
  const id = z.string().uuid().parse(data.get("id"));
  const database = db();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.githubId, session.githubId));
  if (!user) throw new Error("Sessão inválida.");
  await database
    .delete(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, user.id)));
  revalidatePath("/dashboard");
}
