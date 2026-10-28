"use client";
import { useState } from "react";
import { saveReport } from "@/app/(private)/assistente/actions";
export function ReportEditor({ id, initial }: { id: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <details>
      <summary>Editar relatório e exportar Markdown</summary>
      <p>
        As alterações são suas anotações. Não substituem a resposta original nem
        sua evidência.
      </p>
      <label>
        Relatório editável
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={30000}
        />
      </label>
      <div className="toolbar">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setMessage((await saveReport(id, text)).message);
            } catch {
              setMessage("Não foi possível salvar o relatório.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar edição
        </button>
        <button
          className="secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/markdown;charset=utf-8" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "relatorio-de-analise.md";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Baixar Markdown
        </button>
      </div>
      <p role="status">{message}</p>
    </details>
  );
}
