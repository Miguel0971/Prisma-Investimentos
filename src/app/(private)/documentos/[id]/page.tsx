import { and, eq, asc, ilike } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { owner } from "@/lib/owner";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { DocumentControls } from "@/components/document-upload";
export default async function Document({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; trecho?: string }>;
}) {
  const user = await owner();
  const { id } = await params;
  const { q, trecho } = await searchParams;
  const chunk = z.string().uuid().safeParse(trecho);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [doc] = await db()
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  if (!doc) notFound();
  const rows = await db()
    .select()
    .from(documentChunks)
    .where(
      and(
        eq(documentChunks.documentId, id),
        chunk.success ? eq(documentChunks.id, chunk.data) : undefined,
        q ? ilike(documentChunks.content, `%${q.slice(0, 100)}%`) : undefined,
      ),
    )
    .orderBy(asc(documentChunks.ordinal))
    .limit(100);
  return (
    <>
      <h1>{doc.title ?? doc.name}</h1>
      <p>
        {doc.author ?? "Autor não identificado"} · {doc.category}
      </p>
      <DocumentControls id={id} status={doc.status} />
      <form className="toolbar">
        <label>
          Pesquisar no texto
          <input name="q" defaultValue={q} />
        </label>
        <button>Pesquisar</button>
      </form>
      <p>
        Pré-visualização textual, até 100 trechos. Tabelas extraídas devem ser
        conferidas com o original antes de calcular.
      </p>
      {rows.map((r) => (
        <section className="panel" id={r.id} key={r.id}>
          <h2>{r.location}</h2>
          <pre>{r.content}</pre>
        </section>
      ))}
      {!rows.length && (
        <p>
          Nenhum trecho disponível nesta busca. Processe o documento ou revise o
          termo.
        </p>
      )}
    </>
  );
}

export const maxDuration = 60;
