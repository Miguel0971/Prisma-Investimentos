import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { authConfigured, isOwner } from "./policy";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
export async function apiOwner() {
  if (!authConfigured(process.env)) return null;
  const session = await getServerSession(authOptions);
  if (!isOwner(session?.githubId, process.env.OWNER_GITHUB_ID)) return null;
  const [user] = await db()
    .select()
    .from(users)
    .where(eq(users.githubId, session!.githubId));
  return user ?? null;
}
export function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    new URL(process.env.NEXTAUTH_URL ?? request.url).origin
  );
}
