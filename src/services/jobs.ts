import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { tickerSchema } from "../lib/policy";
import { cnpjSchema, cvmType, yearSchema } from "./cvm";
export const jobPayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quote"), ticker: tickerSchema }),
  z.object({
    kind: z.literal("cvm"),
    cnpj: cnpjSchema,
    type: cvmType,
    year: yearSchema,
  }),
  z.object({ kind: z.literal("embedding"), documentId: z.string().uuid() }),
]);
export function retryDelay(attempt: number) {
  return Math.min(3600, 60 * 2 ** Math.max(0, attempt - 1)) * 1000;
}
export function scheduleKey(
  userId: string,
  payload: z.infer<typeof jobPayload>,
  day: string,
) {
  return `${userId}:${JSON.stringify(payload)}:${day}`;
}
export function cronAuthorized(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
