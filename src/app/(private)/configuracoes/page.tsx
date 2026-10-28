import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { syncSources, syncJobs, aiConversations } from "@/db/schema";
import { owner } from "@/lib/owner";
import { SyncControls } from "@/components/sync-controls";
import { dateTime } from "@/lib/format";
export default async function Settings() {
  const user = await owner();
  const sources = await db()
    .select()
    .from(syncSources)
    .where(eq(syncSources.userId, user.id));
  const jobs = await db()
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.userId, user.id))
    .orderBy(desc(syncJobs.createdAt))
    .limit(40);
  const usage = await db()
    .select({ tokens: aiConversations.tokens })
    .from(aiConversations)
    .where(eq(aiConversations.userId, user.id));
  const tokens = usage.reduce((n, r) => n + r.tokens, 0);
  const rate = Number(process.env.AI_USD_PER_MILLION_TOKENS);
  return (
    <>
      <span className="eyebrow">AMBIENTE E OPERAÇÃO</span>
      <h1>Configurações e integrações</h1>
      <section className="panel">
        <h2>Estado das integrações</h2>
        <p>
          Presença de variável não comprova conectividade. Segredos nunca são
          exibidos.
        </p>
        <dl>
          <dt>GitHub / Neon</dt>
          <dd>Configurados; sessão autenticada</dd>
          <dt>Brapi</dt>
          <dd>
            {process.env.BRAPI_TOKEN
              ? "Token configurado"
              : "Sem token; somente ativos liberados pelo fornecedor"}
          </dd>
          <dt>Blob privado</dt>
          <dd>
            {process.env.BLOB_READ_WRITE_TOKEN
              ? "Token configurado"
              : "Não configurado"}
          </dd>
          <dt>IA</dt>
          <dd>
            {process.env.AI_ENABLED === "true"
              ? "Habilitada — chamadas podem gerar custo"
              : "Desativada"}
          </dd>
          <dt>Cron</dt>
          <dd>
            {process.env.CRON_SECRET
              ? "Segredo configurado"
              : "Não configurado"}
          </dd>
          <dt>Consumo textual registrado</dt>
          <dd>
            {tokens} tokens (respostas + consulta vetorial; lotes de indexação
            têm reserva separada no limite diário)
          </dd>
          <dt>Estimativa de custo textual</dt>
          <dd>
            {rate > 0
              ? `US$ ${((tokens / 1e6) * rate).toFixed(4)} pela tarifa média manual. Não é fatura.`
              : "Tarifa não configurada. Defina AI_USD_PER_MILLION_TOKENS; faturamento oficial é do provedor."}
          </dd>
        </dl>
      </section>
      <SyncControls
        sources={sources.map((s) => ({ id: s.id, payload: s.payload }))}
      />
      <section className="panel">
        <h2>Execuções recentes</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Status</th>
                <th>Tentativas</th>
                <th>Atualização</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.kind}</td>
                  <td>{j.status}</td>
                  <td>{j.attempts}</td>
                  <td>{dateTime(j.updatedAt)}</td>
                  <td>{j.result ?? "Aguardando"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export const maxDuration = 60;
