import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Banco de dados não configurado.");
  return drizzle(neon(url), { schema });
}
