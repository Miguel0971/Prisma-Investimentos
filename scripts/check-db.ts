import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
config({ path: ".env.local" });
async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL ausente. Configure .env.local.");
  const sql = neon(process.env.DATABASE_URL);
  const id = "integration-" + crypto.randomUUID();
  try {
    const [user] =
      await sql`INSERT INTO users(github_id,name) VALUES (${id},'Teste de integração') RETURNING id`;
    await sql`INSERT INTO watchlists(user_id,ticker) VALUES (${user.id},'PETR4')`;
    const rows =
      await sql`SELECT ticker FROM watchlists WHERE user_id=${user.id}`;
    if (rows.length !== 1 || rows[0].ticker !== "PETR4")
      throw new Error("Persistência inconsistente.");
    let rejected = false;
    try {
      await sql`INSERT INTO watchlists(user_id,ticker) VALUES (${user.id},'PETR4')`;
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Restrição de unicidade ausente.");
    await sql`DELETE FROM users WHERE id=${user.id}`;
    const remaining =
      await sql`SELECT id FROM watchlists WHERE user_id=${user.id}`;
    if (remaining.length) throw new Error("Exclusão em cascata falhou.");
    console.log(
      "PASS: INSERT, SELECT, unicidade e DELETE em cascata no banco configurado.",
    );
  } finally {
    await sql`DELETE FROM users WHERE github_id=${id}`;
  }
}
main().catch(() => {
  console.error(
    "FAIL: validação do banco. Verifique configuração, conectividade e migrações; detalhes sensíveis omitidos.",
  );
  process.exitCode = 1;
});
