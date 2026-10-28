import { vector } from "@electric-sql/pglite-pgvector";
import { PGlite } from "@electric-sql/pglite";
import { describe, it, expect } from "vitest";
import { readdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
describe("PostgreSQL embarcado real (PGlite, não Neon)", () => {
  it("aplica migrations, valida FK/unicidade e persiste ao reabrir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "prisma-db-"));
    let pg = new PGlite(dir, { extensions: { vector } });
    try {
      for (const file of (await readdir("drizzle"))
        .filter((x) => x.endsWith(".sql"))
        .sort())
        await pg.exec(await readFile(join("drizzle", file), "utf8"));
      const result = await pg.query<{ id: string }>(
        "INSERT INTO users(github_id,name) VALUES ($1,$2) RETURNING id",
        ["123", "Usuário de teste"],
      );
      const id = result.rows[0].id;
      await pg.query("INSERT INTO watchlists(user_id,ticker) VALUES ($1,$2)", [
        id,
        "PETR4",
      ]);
      await expect(
        pg.query("INSERT INTO watchlists(user_id,ticker) VALUES ($1,$2)", [
          id,
          "PETR4",
        ]),
      ).rejects.toThrow();
      await expect(
        pg.query(
          "INSERT INTO watchlists(user_id,ticker) VALUES ('00000000-0000-0000-0000-000000000000','VALE3')",
        ),
      ).rejects.toThrow();
      await pg.close();
      pg = new PGlite(dir, { extensions: { vector } });
      expect((await pg.query("SELECT ticker FROM watchlists")).rows).toEqual([
        { ticker: "PETR4" },
      ]);
      await pg.query("DELETE FROM users WHERE id=$1", [id]);
      expect((await pg.query("SELECT * FROM watchlists")).rows).toHaveLength(0);
    } finally {
      await pg.close();
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
