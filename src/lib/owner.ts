import "server-only";
import { eq } from "drizzle-orm";
import { requireOwner } from "./auth";
import { db } from "@/db";
import { users } from "@/db/schema";
export async function owner() {
  const session = await requireOwner();
  const [user] = await db()
    .select()
    .from(users)
    .where(eq(users.githubId, session.githubId));
  if (!user) throw Error("Usuário não encontrado. Entre novamente.");
  return user;
}
