import Link from "next/link";
import { ReportEditor } from "@/components/report-editor";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { documents, aiConversations } from "@/db/schema";
import { owner } from "@/lib/owner";
import { AssistantChat } from "@/components/assistant-chat";
import type { GroundedAnswer, Passage } from "@/services/ai";
import { dateTime } from "@/lib/format";
export default async function Assistant() {
  const user = await owner();
  const docs = await db()
    .select({ id: documents.id, name: documents.name })
    .from(documents)
    .where(and(eq(documents.userId, user.id), eq(documents.status, "ready")))
    .limit(100);
  const history = await db()
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, user.id))
    .orderBy(desc(aiConversations.createdAt))
    .limit(20);
  return (
    <>
      <span className="eyebrow">ANÁLISE DOCUMENTAL</span>
      <h1>Assistente de investimentos</h1>
      {process.env.AI_ENABLED !== "true" && (
        <p className="notice">
          IA desativada. Configure as variáveis no servidor para habilitar
          chamadas pagas.
        </p>
      )}
      <AssistantChat docs={docs} />
      {history.map((h) => (
        <section className="panel" key={h.id}>
          <h2>{h.question}</h2>
          <p>
            {dateTime(h.createdAt)} · {h.tokens} tokens{" "}
            {h.estimated ? "estimados" : "informados"} · {h.model}
          </p>
          <h3>Premissa informada pelo usuário</h3>
          <p>{h.question}</p>
          {(h.answer as GroundedAnswer).items.map((item, i) => (
            <div key={i}>
              <h3>
                {
                  {
                    inferencia: "Inferência — não é fato verificado",
                    risco: "Risco ou incerteza",
                    ausencia: "Informação ausente",
                  }[item.category]
                }
              </h3>
              <p>{item.text}</p>
              {item.citations.map((id) => {
                const source = (h.sources as Passage[]).find(
                  (s) => s.id === id,
                );
                return source ? (
                  <Link
                    key={id}
                    href={`/documentos/${source.documentId}?trecho=${id}#${id}`}
                  >
                    [{source.title} · {source.location}]{" "}
                  </Link>
                ) : null;
              })}
            </div>
          ))}
          <details>
            <summary>Trechos verificáveis recuperados do arquivo</summary>
            {(h.sources as Passage[]).map((s) => (
              <blockquote key={s.id}>
                <strong>
                  {s.title} · {s.location}
                </strong>
                <p>{s.content}</p>
              </blockquote>
            ))}
          </details>
          <p>Cálculos matemáticos: não executados nesta resposta.</p>
          <ReportEditor
            id={h.id}
            initial={
              h.reportDraft ??
              `# ${h.question}\n\nData: ${dateTime(h.createdAt)}\n\n${(h.answer as GroundedAnswer).items.map((item) => `## ${item.category}\n${item.text}\nFontes: ${item.citations.join(", ")}`).join("\n\n")}\n\n## Referências\n${(h.sources as Passage[]).map((source) => `${source.id} — ${source.title}, ${source.location}`).join("\n")}`
            }
          />
        </section>
      ))}
    </>
  );
}

export const maxDuration = 60;
