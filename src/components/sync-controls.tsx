"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addSource,
  removeSource,
  syncNext,
} from "@/app/(private)/configuracoes/actions";
export function SyncControls({
  sources,
}: {
  sources: { id: string; payload: unknown }[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState("quote");
  const [ticker, setTicker] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [type, setType] = useState("DFP");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>Fontes para atualização</h2>
      <form
        className="toolbar"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await addSource(
              kind === "quote" ? { kind, ticker } : { kind, cnpj, type, year },
            );
            setMessage("Fonte cadastrada.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Falha ao cadastrar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="quote">Cotação Brapi</option>
            <option value="cvm">Documentos CVM</option>
          </select>
        </label>
        {kind === "quote" ? (
          <label>
            Ticker
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
            />
          </label>
        ) : (
          <>
            <label>
              CNPJ
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                required
              />
            </label>
            <label>
              Documento
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {["DFP", "ITR", "FRE", "IPE"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Ano
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min="2010"
                max={new Date().getFullYear()}
              />
            </label>
          </>
        )}
        <button disabled={busy}>Cadastrar fonte</button>
      </form>
      {sources.map((s) => (
        <div className="toolbar" key={s.id}>
          <code>{JSON.stringify(s.payload)}</code>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await removeSource(s.id);
                router.refresh();
              } catch {
                setMessage("Falha ao remover fonte.");
              }
            }}
          >
            Remover fonte
          </button>
        </div>
      ))}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setMessage((await syncNext()).message);
            router.refresh();
          } catch {
            setMessage("Falha na sincronização.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Sincronizando…" : "Agendar fontes e executar próximo job"}
      </button>
      <p role="status">{message}</p>
      <small>
        O botão executa uma unidade; o cron diário executa até três em paralelo,
        com até três tentativas por job. Uma fonte já pendente não é enfileirada
        novamente. Mais fontes exigem execuções manuais adicionais ou um
        agendador compatível com seu plano.
      </small>
    </section>
  );
}
