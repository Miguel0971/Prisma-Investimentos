import "server-only";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authConfigured, isOwner } from "./policy";
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/entrar", error: "/entrar" },
  callbacks: {
    async signIn({ account, user }) {
      if (
        !authConfigured(process.env) ||
        account?.provider !== "github" ||
        !isOwner(account.providerAccountId, process.env.OWNER_GITHUB_ID)
      )
        return false;
      try {
        await db()
          .insert(users)
          .values({
            githubId: account.providerAccountId,
            name: user.name ?? "Proprietário",
          })
          .onConflictDoUpdate({
            target: users.githubId,
            set: { name: user.name ?? "Proprietário", updatedAt: new Date() },
          });
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account) token.githubId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      session.githubId =
        typeof token.githubId === "string" ? token.githubId : "";
      return session;
    },
  },
  logger: {
    error() {
      console.error(
        "Falha de autenticação. Verifique configuração e conectividade.",
      );
    },
    warn() {},
    debug() {},
  },
};
export async function requireOwner() {
  if (!authConfigured(process.env)) redirect("/entrar");
  const session = await getServerSession(authOptions);
  if (!isOwner(session?.githubId, process.env.OWNER_GITHUB_ID))
    redirect("/entrar");
  return session!;
}
