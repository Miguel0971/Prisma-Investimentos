import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
const state = vi.hoisted(() => ({
  database: null as unknown,
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    githubId: "123",
    name: "Proprietário de teste",
  },
  authorized: true,
  blobs: new Map<string, Uint8Array>(),
}));
vi.mock("../src/db", () => ({ db: () => state.database }));
vi.mock("../src/lib/owner", () => ({
  owner: async () => {
    if (!state.authorized) throw Error("Não autorizado");
    return state.user;
  },
}));
vi.mock("../src/lib/api-auth", () => ({
  apiOwner: async () => (state.authorized ? state.user : null),
  sameOrigin: (r: Request) =>
    r.headers.get("origin") === "https://test.example",
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@vercel/blob", () => ({
  get: async (path: string) => {
    const bytes = state.blobs.get(path);
    return bytes
      ? {
          statusCode: 200,
          blob: { size: bytes.length },
          stream: new Response(new Uint8Array(bytes)).body,
        }
      : null;
  },
  del: async (path: string) => {
    state.blobs.delete(path);
  },
}));
import {
  saveFormula,
  calculate,
  archiveFormula,
} from "../src/app/(private)/laboratorio/actions";
import {
  processDocument,
  deleteDocument,
} from "../src/app/(private)/documentos/actions";
import { GET as download } from "../src/app/api/documents/[id]/route";
import { POST as upload } from "../src/app/api/upload/route";
import { indexDocument, askDocuments } from "../src/services/ai-server";
import { runNext, enqueue } from "../src/services/jobs-server";
import { saveReport } from "../src/app/(private)/assistente/actions";
import { withLease } from "../src/services/leases";
import { consume } from "../src/services/limits";
const pg = new PGlite({ extensions: { vector } });
const database = drizzle(pg, { schema });
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(join("drizzle", file), "utf8"));
  state.database = Object.assign(database, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      await pg.exec("BEGIN");
      try {
        const results = [];
        for (const query of queries) results.push(await query);
        await pg.exec("COMMIT");
        return results;
      } catch (e) {
        await pg.exec("ROLLBACK");
        throw e;
      }
    },
  });
  await database.insert(schema.users).values(state.user);
});
afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await pg.close();
});
it("salva fórmula, executa, versiona e mantém resultado anterior", async () => {
  const f = {
    name: "Teste por ação",
    description: "Fixture",
    category: "Valuation",
    expression: "valor / acoes",
    variables: [
      { name: "valor", label: "Valor", unit: "BRL" },
      { name: "acoes", label: "Ações", unit: "acoes" },
    ],
  };
  await saveFormula(f, { valor: "1000", acoes: "100" });
  const [formula] = await database.select().from(schema.formulas);
  const [version] = await database.select().from(schema.formulaVersions);
  await calculate("custom", { valor: "1000", acoes: "100" }, version.id);
  await saveFormula(
    { ...f, expression: "valor * 2 / acoes" },
    { valor: "1000", acoes: "100" },
    formula.id,
  );
  expect(await database.select().from(schema.formulaVersions)).toHaveLength(2);
  const [run] = await database.select().from(schema.valuationRuns);
  expect((run.result as { value: string }).value).toBe("10");
  expect(run.versionId).toBe(version.id);
  await archiveFormula(formula.id);
  expect((await database.select().from(schema.formulas))[0].archived).toBe(
    true,
  );
});
it("processa arquivo privado, deduplica, indexa pgvector, responde e exclui associados", async () => {
  const docId = "22222222-2222-4222-8222-222222222222";
  const pathname = "documents/test/file.txt";
  const bytes = new TextEncoder().encode(
    "Receita informada no relatório autorizado: 100. A concentração de clientes é um risco.",
  );
  state.blobs.set(pathname, bytes);
  await database
    .insert(schema.documents)
    .values({
      id: docId,
      userId: state.user.id,
      name: "Relatório autorizado.txt",
      category: "relatorios",
      pathname,
    });
  expect((await processDocument(docId)).message).toContain("Processado");
  expect(await database.select().from(schema.documentChunks)).toHaveLength(1);
  const duplicateId = "33333333-3333-4333-8333-333333333333";
  state.blobs.set("documents/duplicate/file.txt", bytes);
  await database
    .insert(schema.documents)
    .values({
      id: duplicateId,
      userId: state.user.id,
      name: "Cópia.txt",
      category: "relatorios",
      pathname: "documents/duplicate/file.txt",
    });
  expect((await processDocument(duplicateId)).message).toContain("duplicado");
  expect(await database.select().from(schema.documents)).toHaveLength(1);
  vi.stubEnv("AI_ENABLED", "true");
  vi.stubEnv("AI_API_KEY", "CHAVE_FICTICIA_DE_TESTE");
  vi.stubEnv("AI_BASE_URL", "https://provider.example/v1");
  vi.stubEnv("AI_MODEL", "modelo-simulado");
  vi.stubEnv("AI_EMBEDDING_MODEL", "embedding-simulado");
  const [chunk] = await database.select().from(schema.documentChunks);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (url.endsWith("/embeddings"))
        return Response.json({
          data: body.input.map((_: string, index: number) => ({
            index,
            embedding: Array(1536).fill(0.1),
          })),
          usage: { total_tokens: 12 },
        });
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                items: [
                  {
                    category: "risco",
                    text: "O relatório aponta concentração de clientes.",
                    citations: [chunk.id],
                  },
                ],
              }),
            },
          },
        ],
        usage: { total_tokens: 50 },
      });
    }),
  );
  expect((await indexDocument(state.user.id, docId)).message).toContain(
    "1 trechos",
  );
  expect(await database.select().from(schema.embeddings)).toHaveLength(1);
  const response = await askDocuments(
    state.user.id,
    [docId],
    "Quais riscos constam?",
    false,
  );
  expect(response.sources[0].id).toBe(chunk.id);
  expect(response.answer.items[0].citations).toEqual([chunk.id]);
  expect(await database.select().from(schema.aiConversations)).toHaveLength(1);
  const callsBefore = vi.mocked(fetch).mock.calls.length;
  const cached = await askDocuments(
    state.user.id,
    [docId],
    "Quais riscos constam?",
    false,
  );
  expect(cached.cached).toBe(true);
  expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
  const [conversation] = await database.select().from(schema.aiConversations);
  await saveReport(conversation.id, "# Minha revisão\nFonte conferida.");
  expect(
    (await database.select().from(schema.aiConversations))[0].reportDraft,
  ).toContain("Minha revisão");
  const fileResponse = await download(
    new Request("https://test.example/api/documents/" + docId),
    { params: Promise.resolve({ id: docId }) },
  );
  expect(fileResponse.status).toBe(200);
  expect(fileResponse.headers.get("cache-control")).toBe("private, no-store");
  expect(await fileResponse.text()).toContain("100");
  await deleteDocument(docId);
  expect(state.blobs.has(pathname)).toBe(false);
  expect(await database.select().from(schema.documentChunks)).toHaveLength(0);
  expect(await database.select().from(schema.embeddings)).toHaveLength(0);
  expect(await database.select().from(schema.aiConversations)).toHaveLength(0);
  vi.unstubAllGlobals();
});
it("recusa upload, download e ações sem autorização", async () => {
  state.authorized = false;
  try {
    expect(
      (
        await upload(
          new Request("https://test.example/api/upload", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await download(new Request("https://test.example/api/documents/x"), {
          params: Promise.resolve({ id: "x" }),
        })
      ).status,
    ).toBe(401);
    await expect(calculate("DCF", {})).rejects.toThrow("Não autorizado");
  } finally {
    state.authorized = true;
  }
});
it("limite distribuído reserva consumo atomicamente", async () => {
  await consume("teste", 3, 5, 60000);
  await expect(consume("teste", 3, 5, 60000)).rejects.toThrow("Limite");
  await consume("teste", 2, 5, 60000);
});
it("jobs idempotentes e sem execução duplicada com reivindicações simultâneas", async () => {
  const payload = { kind: "quote", ticker: "PETR4" };
  await enqueue(state.user.id, payload, "2026-10-28");
  await enqueue(state.user.id, payload, "2026-10-29");
  expect(await database.select().from(schema.syncJobs)).toHaveLength(1);
  const fetcher = vi.fn(async () =>
    Response.json({
      results: [
        {
          symbol: "PETR4",
          currency: "BRL",
          regularMarketPrice: 10,
          regularMarketTime: "2025-01-01T12:00:00Z",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([runNext(state.user.id), runNext(state.user.id)]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [job] = await database.select().from(schema.syncJobs);
  expect(job.status).toBe("done");
  expect(job.attempts).toBe(1);
  vi.unstubAllGlobals();
});
it("job falho agenda retry sem expor erro sensível", async () => {
  await enqueue(state.user.id, { kind: "quote", ticker: "VALE3" });
  vi.stubGlobal("fetch", async () => {
    throw Error("SEGREDO_NAO_PODE_APARECER");
  });
  await runNext(state.user.id);
  const jobs = await database
    .select()
    .from(schema.syncJobs)
    .where(eq(schema.syncJobs.status, "queued"));
  expect(jobs).toHaveLength(1);
  expect(jobs[0].result).not.toContain("SEGREDO");
  expect(jobs[0].availableAt.getTime()).toBeGreaterThan(Date.now());
  vi.unstubAllGlobals();
});

it("gera token de upload com SDK real, credencial fictícia e escopo limitado", async () => {
  vi.stubEnv(
    "BLOB_READ_WRITE_TOKEN",
    "vercel_blob_rw_TESTSTORE_FAKE_TEST_ONLY",
  );
  const pathname = "documents/44444444-4444-4444-8444-444444444444/file.txt";
  const request = new Request("https://test.example/api/upload", {
    method: "POST",
    headers: {
      origin: "https://test.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        clientPayload: JSON.stringify({
          name: "teste.txt",
          category: "relatorios",
        }),
        multipart: false,
      },
    }),
  });
  const response = await upload(request);
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.clientToken).toContain("vercel_blob_client_TESTSTORE_");
  expect(result.clientToken).not.toContain("FAKE_TEST_ONLY");
  const signed = Buffer.from(
    result.clientToken.split("_").at(-1)!,
    "base64",
  ).toString();
  const payload = JSON.parse(
    Buffer.from(signed.split(".")[1], "base64").toString(),
  );
  expect(payload.pathname).toBe(pathname);
  expect(payload.maximumSizeInBytes).toBe(20 * 1024 * 1024);
  expect(payload.allowOverwrite).toBe(false);
  await database
    .delete(schema.documents)
    .where(eq(schema.documents.pathname, pathname));
  const crossOrigin = await upload(
    new Request("https://test.example/api/upload", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  );
  expect(crossOrigin.status).toBe(403);
});
it("lease distribuído rejeita concorrência e libera após erro", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let signal: () => void = () => {};
  const entered = new Promise<void>((resolve) => {
    signal = resolve;
  });
  const first = withLease("teste:lease", 60000, async () => {
    signal();
    await gate;
    return 1;
  });
  await entered;
  await expect(withLease("teste:lease", 60000, async () => 2)).rejects.toThrow(
    "andamento",
  );
  release();
  expect(await first).toBe(1);
  await expect(
    withLease("teste:lease", 60000, async () => {
      throw Error("falha");
    }),
  ).rejects.toThrow("falha");
  expect(await withLease("teste:lease", 60000, async () => 3)).toBe(3);
});

it("preserva revisões CVM sem duplicar e vincula conta a cálculo auditável", async () => {
  const { persistOfficialPackage } =
    await import("../src/services/cvm-repository");
  const company = {
    cnpj: "00000000000191",
    name: "Companhia de teste",
    cvmCode: "1",
    sector: "Teste",
    website: null,
    status: "ATIVO",
  };
  const doc = {
    externalId: "DFP:TEST:1",
    title: "Relatório de teste",
    cnpj: company.cnpj,
    category: "DFP",
    reference: "2025-12-31",
    published: "2026-03-01",
    version: "1",
    url: "https://www.rad.cvm.gov.br/test",
    source: "https://dados.cvm.gov.br/test",
  };
  const row = {
    code: "3.01",
    label: "Receita",
    value: "1234.50",
    currency: "REAL",
    scale: "MIL",
    period: "2025-12-31",
    reference: "2025-12-31",
    version: "1",
    exercise: "ÚLTIMO",
    group: "DRE consolidada",
  };
  const report = {
    docs: [doc],
    rows: [row],
    source: "https://dados.cvm.gov.br/test",
  };
  await persistOfficialPackage(company, report, "DFP");
  await persistOfficialPackage(company, report, "DFP");
  expect(await database.select().from(schema.officialDocuments)).toHaveLength(
    1,
  );
  expect(await database.select().from(schema.financialStatements)).toHaveLength(
    1,
  );
  await persistOfficialPackage(
    company,
    {
      ...report,
      docs: [{ ...doc, published: "2026-03-02" }],
      rows: [{ ...row, value: "1235.00" }],
    },
    "DFP",
  );
  expect(await database.select().from(schema.officialDocuments)).toHaveLength(
    2,
  );
  expect(await database.select().from(schema.financialStatements)).toHaveLength(
    2,
  );
  const [account] = await database
    .select()
    .from(schema.financialStatements)
    .where(eq(schema.financialStatements.value, "1234.50"));
  const run = await calculate(
    "Valor futuro",
    { taxa: "0", periodos: "1" },
    undefined,
    { presente: account.id },
  );
  expect(run.result.value).toBe("1234500");
  expect(
    (run.result.sources as Record<string, { originalScale: string }>).presente
      .originalScale,
  ).toBe("MIL");
  await expect(
    calculate(
      "Valor futuro",
      { presente: "1", taxa: "0", periodos: "1" },
      undefined,
      { taxa: account.id },
    ),
  ).rejects.toThrow("monetárias");
});
