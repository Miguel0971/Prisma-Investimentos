import Link from "next/link";
import { and, eq, desc, ilike } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { owner } from "@/lib/owner";
import { DocumentUpload, DocumentControls } from "./document-upload";
export async function DocumentList({
  books = false,
  query = "",
}: {
  books?: boolean;
  query?: string;
}) {
  const user = await owner();
  const docs = await db()
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, user.id),
        books ? eq(documents.category, "livros") : undefined,
        query ? ilike(documents.name, `%${query.slice(0, 100)}%`) : undefined,
      ),
    )
    .orderBy(desc(documents.createdAt))
    .limit(100);
  return (
    <>
      <section className="panel">
        <DocumentUpload />
      </section>
      <form className="toolbar">
        <label>
          Pesquisar nome
          <input name="q" defaultValue={query} />
        </label>
        <button>Pesquisar</button>
      </form>
      {docs.map((d) => (
        <section className="panel" key={d.id}>
          <h2>
            <Link href={`/documentos/${d.id}`}>{d.title ?? d.name}</Link>
          </h2>
          <p>
            {d.author ? `${d.author} · ` : ""}
            {d.category} ·{" "}
            {(
              {
                pending: "Aguardando processamento",
                ready: "Texto disponível",
                error: "Falha de processamento",
                deleting: "Exclusão em andamento",
              } as Record<string, string>
            )[d.status] ?? d.status}
          </p>
          {d.error && <p role="alert">{d.error}</p>}
          <DocumentControls id={d.id} status={d.status} />
        </section>
      ))}
      {!docs.length && <p>Nenhum arquivo nesta seleção.</p>}
    </>
  );
}
