"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ask, indexForAi } from "@/app/(private)/assistente/actions";
export function AssistantChat({
  docs,
}: {
  docs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="panel">
      <h2>Conversa com fontes selecionadas</h2>
      <p>
        Somente trechos relevantes serão enviados ao provedor configurado.
        Indexe os documentos em lotes antes de perguntar. O conteúdo continua
        sujeito às políticas de dados desse provedor.
      </p>
      {docs.map((d) => (
        <div className="toolbar" key={d.id}>
          <label>
            <input
              type="checkbox"
              checked={ids.includes(d.id)}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? [...ids, d.id]
                    : ids.filter((id) => id !== d.id),
                )
              }
            />{" "}
            {d.name}
          </label>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setMessage((await indexForAi(d.id)).message);
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Indexação falhou.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Indexar próximo lote
          </button>
        </div>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await ask({ ids, question, deep });
            setMessage("Resposta salva no histórico abaixo.");
            router.refresh();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Não foi possível responder.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="question">Pergunta documental</label>
        <textarea
          id="question"
          minLength={3}
          maxLength={1500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          placeholder="Quais riscos aparecem nestes relatórios?"
        />
        <label>
          <input
            type="checkbox"
            checked={deep}
            onChange={(e) => setDeep(e.target.checked)}
          />{" "}
          Resposta aprofundada (maior consumo)
        </label>
        <button disabled={busy || !ids.length}>
          {busy ? "Processando…" : "Consultar documentos"}
        </button>
      </form>
      <p role="status">{message}</p>
      <small>
        IA não faz cálculos de valuation. Use o laboratório para resultados
        determinísticos. Inferências precisam de revisão humana mesmo com
        referências válidas.
      </small>
    </section>
  );
}
