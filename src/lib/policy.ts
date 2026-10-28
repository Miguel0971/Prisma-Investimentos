import { z } from "zod";
export function isOwner(id: unknown, allowed: string | undefined): boolean {
  return (
    !!allowed &&
    /^\d+$/.test(allowed) &&
    typeof id === "string" &&
    id === allowed
  );
}
export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}[0-9]{1,2}$/, "Use um ticker B3, como PETR4.");
export function authConfigured(
  env: Record<string, string | undefined>,
): boolean {
  return (
    !!env.NEXTAUTH_URL &&
    (env.NEXTAUTH_SECRET?.length ?? 0) >= 32 &&
    !!env.GITHUB_CLIENT_ID &&
    !!env.GITHUB_CLIENT_SECRET &&
    /^\d+$/.test(env.OWNER_GITHUB_ID ?? "") &&
    !!env.DATABASE_URL
  );
}
