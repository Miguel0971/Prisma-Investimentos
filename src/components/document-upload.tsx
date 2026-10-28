"use client";
import { upload } from "@vercel/blob/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  processDocument,
  deleteDocument,
} from "@/app/(private)/documentos/actions";
export function DocumentUpload() {
  const router = useRouter();
  const [category, setCategory] = useState("relatorios");
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        try {
          if (file.size > 20 * 1024 * 1024) throw Error("Máximo 20 MB.");
          const ext = file.name.toLowerCase().split(".").at(-1);
          await upload(`documents/${crypto.randomUUID()}/file.${ext}`, file, {
            access: "private",
            handleUploadUrl: "/api/upload",
            clientPayload: JSON.stringify({ name: file.name, category }),
            onUploadProgress: (p) => setProgress(p.percentage),
          });
          setMessage(
            "Arquivo enviado. Clique em Processar na lista para extrair o conteúdo.",
          );
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Falha no upload.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="toolbar">
        <label>
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "empresas",
              "relatorios",
              "planilhas",
              "livros",
              "metodologias",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Arquivo privado
          <input
            type="file"
            required
            accept=".pdf,.epub,.xlsx,.csv,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>
        <button disabled={busy}>{busy ? "Enviando…" : "Enviar arquivo"}</button>
      </div>
      <progress value={progress} max="100" aria-label="Progresso do upload" />
      <p role="status">{message}</p>
      <small>
        Até 20 MB. Envie somente arquivos que você tem direito de armazenar e
        analisar. Extração: até 300 páginas/600 mil caracteres. PDFs
        digitalizados exigem OCR externo.
      </small>
    </form>
  );
}
export function DocumentControls({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <div className="toolbar">
        {status !== "ready" && status !== "deleting" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setMessage((await processDocument(id)).message);
                router.refresh();
              } catch {
                setMessage("Falha ao processar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Processando…" : "Processar"}
          </button>
        )}
        <a href={`/api/documents/${id}`}>Baixar original</a>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Excluir arquivo, texto e índices associados?"))
              return;
            setBusy(true);
            try {
              await deleteDocument(id);
              router.refresh();
            } catch {
              setMessage("Exclusão incompleta. Tente novamente para concluir.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Excluir
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}
