import "server-only";
import { createHash } from "node:crypto";
import { withLease, withLeases } from "./leases";
import { eq, and, sql, inArray, asc, isNull, or, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  documentChunks,
  embeddings,
  aiConversations,
} from "@/db/schema";
import {
  aiConfig,
  embed,
  answerQuestion,
  makeMessages,
  type Passage,
} from "./ai";
import { consume } from "./limits";
const modelKey = (c: ReturnType<typeof aiConfig>) =>
  `${c.baseUrl}#${c.embeddingModel}`;
async function indexUnlocked(userId: string, id: string) {
  const config = aiConfig(process.env);
  const database = db();
  const [doc] = await database
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.userId, userId),
        eq(documents.status, "ready"),
      ),
    );
  if (!doc) throw Error("Documento não disponível para indexação.");
  const rows = await database
    .select({ id: documentChunks.id, content: documentChunks.content })
    .from(documentChunks)
    .leftJoin(embeddings, eq(embeddings.chunkId, documentChunks.id))
    .where(
      and(
        eq(documentChunks.documentId, id),
        or(isNull(embeddings.chunkId), ne(embeddings.model, modelKey(config))),
      ),
    )
    .orderBy(asc(documentChunks.ordinal))
    .limit(12);
  if (!rows.length)
    return { message: "Indexação atualizada; nenhum trecho pendente." };
  await consume(
    `ai:${userId}`,
    rows.reduce((n, r) => n + Buffer.byteLength(r.content, "utf8") + 32, 0),
    Number(process.env.AI_DAILY_TOKEN_BUDGET) || 100000,
    86400_000,
  );
  const result = await embed(
    config,
    rows.map((r) => r.content),
  );
  for (let i = 0; i < rows.length; i++)
    await database
      .insert(embeddings)
      .values({
        chunkId: rows[i].id,
        model: modelKey(config),
        embedding: result.vectors[i],
      })
      .onConflictDoUpdate({
        target: embeddings.chunkId,
        set: { model: modelKey(config), embedding: result.vectors[i] },
      });
  return {
    message: `${rows.length} trechos indexados. Repita para continuar se houver mais trechos. Consumo: ${result.tokens} tokens informados/estimados.`,
  };
}
async function askUnlocked(
  userId: string,
  ids: string[],
  question: string,
  deep: boolean,
) {
  const config = aiConfig(process.env);
  const database = db();
  const selected = await database
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, ids),
        eq(documents.status, "ready"),
      ),
    );
  if (selected.length !== ids.length)
    throw Error("Seleção contém documento indisponível.");
  const coverage = await database
    .select({
      documentId: documentChunks.documentId,
      total: sql<number>`count(*)::integer`,
      indexed: sql<number>`count(${embeddings.chunkId})::integer`,
    })
    .from(documentChunks)
    .leftJoin(
      embeddings,
      and(
        eq(embeddings.chunkId, documentChunks.id),
        eq(embeddings.model, modelKey(config)),
      ),
    )
    .where(inArray(documentChunks.documentId, ids))
    .groupBy(documentChunks.documentId);
  if (
    coverage.length !== ids.length ||
    coverage.some((r) => r.total === 0 || r.indexed !== r.total)
  )
    throw Error(
      "Conclua a indexação de todos os documentos selecionados antes de perguntar.",
    );
  const requestKey = createHash("sha256")
    .update(
      JSON.stringify({
        policy: 1,
        userId,
        ids: [...ids].sort(),
        hashes: selected.map((d) => d.hash).sort(),
        question,
        deep,
        model: config.model,
        embedding: modelKey(config),
        output: config.maxOutput,
      }),
    )
    .digest("hex");
  const [previous] = await database
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.requestKey, requestKey));
  if (previous)
    return {
      answer: previous.answer as import("./ai").GroundedAnswer,
      sources: previous.sources as Passage[],
      tokens: 0,
      estimated: false,
      cached: true,
    };
  await consume(`chat-rate:${userId}`, 1, 10, 60_000);
  await consume(
    `ai:${userId}`,
    Buffer.byteLength(question, "utf8") + 32,
    Number(process.env.AI_DAILY_TOKEN_BUDGET) || 100000,
    86400_000,
  );

  const query = await embed(config, [question]);
  const distance = sql<number>`${embeddings.embedding} <=> ${JSON.stringify(query.vectors[0])}::vector`;
  const rows = await database
    .select({
      id: documentChunks.id,
      documentId: documents.id,
      title: documents.title,
      name: documents.name,
      location: documentChunks.location,
      content: documentChunks.content,
      distance,
    })
    .from(embeddings)
    .innerJoin(documentChunks, eq(documentChunks.id, embeddings.chunkId))
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, ids),
        eq(embeddings.model, modelKey(config)),
        sql`${distance}<0.55`,
      ),
    )
    .orderBy(distance)
    .limit(6);
  const passages: Passage[] = rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    title: r.title ?? r.name,
    location: r.location,
    content: r.content,
  }));
  if (passages.length)
    await consume(
      `ai:${userId}`,
      Buffer.byteLength(
        JSON.stringify(makeMessages(question, passages)),
        "utf8",
      ) +
        config.maxOutput +
        256,
      Number(process.env.AI_DAILY_TOKEN_BUDGET) || 100000,
      86400_000,
    );
  const result = await answerQuestion(config, question, passages, deep);
  const sources = passages.map((p) => ({
    ...p,
    content: p.content.slice(0, 400),
  }));
  await database
    .insert(aiConversations)
    .values({
      userId,
      requestKey: passages.length ? requestKey : null,
      documentIds: ids,
      question,
      answer: result.answer,
      sources,
      model: config.model,
      tokens: query.tokens + result.tokens,
      estimated: result.estimated || query.estimated,
    });
  return { ...result, sources, cached: false };
}

export function indexDocument(userId: string, id: string) {
  return withLease(`document:${id}`, 120000, () => indexUnlocked(userId, id));
}

export function askDocuments(
  userId: string,
  ids: string[],
  question: string,
  deep: boolean,
) {
  return withLeases(
    ids.map((id) => `document:${id}`),
    120000,
    () => askUnlocked(userId, ids, question, deep),
  );
}
