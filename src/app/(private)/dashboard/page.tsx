import { requireOwner } from "@/lib/auth";
import { db } from "@/db";
import Link from "next/link";
import { users, watchlists, valuationRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { FavoriteForm } from "@/components/favorite-form";
import { removeFavorite } from "./actions";
export default async function Dashboard() {
  const session = await requireOwner();
  let favorites: { id: string; ticker: string; createdAt: Date }[] = [];
  let failed = false;
  try {
    favorites = await db()
      .select({
        id: watchlists.id,
        ticker: watchlists.ticker,
        createdAt: watchlists.createdAt,
      })
      .from(watchlists)
      .innerJoin(users, eq(users.id, watchlists.userId))
      .where(eq(users.githubId, session.githubId))
      .orderBy(desc(watchlists.createdAt));
  } catch {
    failed = true;
  }
  const runs = failed
    ? []
    : await db()
        .select({
          name: valuationRuns.name,
          createdAt: valuationRuns.createdAt,
        })
        .from(valuationRuns)
        .innerJoin(users, eq(users.id, valuationRuns.userId))
        .where(eq(users.githubId, session.githubId))
        .orderBy(desc(valuationRuns.createdAt))
        .limit(10);
  return (
    <>
      <span className="eyebrow">PESQUISA & DISCIPLINA</span>
      <h1>Visão geral</h1>
      <p className="subtitle">
        Organize sua próxima análise. Cada conclusão começa por uma boa
        pergunta.
      </p>
      <div className="cards">
        <section className="panel">
          <small>LISTA DE ESTUDO</small>
          <strong className="metric">{failed ? "—" : favorites.length}</strong>
          <p>Tickers cadastrados</p>
        </section>
        <section className="panel">
          <small>DADOS DE MERCADO</small>
          <strong className="metric">—</strong>
          <p>
            <Link href="/mercado">Consultar cotação real →</Link>
          </p>
        </section>
        <section className="panel">
          <small>ANÁLISES RECENTES</small>
          <strong className="metric">{runs.length}</strong>
          <p>
            <Link href="/laboratorio">Abrir histórico e calcular →</Link>
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Sua lista de estudo</h2>
        <p>
          Cadastro manual persistente. Não representa uma carteira ou
          recomendação.
        </p>
        {failed ? (
          <p role="alert">
            Não foi possível consultar o banco. Verifique a conexão e as
            migrações.
          </p>
        ) : (
          <>
            <FavoriteForm />
            {favorites.length ? (
              <ul className="favorites">
                {favorites.map((f) => (
                  <li key={f.id}>
                    <Link href={`/mercado?q=${f.ticker}`}>
                      <strong>{f.ticker}</strong>
                    </Link>
                    <span>Preço consultado sob demanda</span>
                    <time>
                      {f.createdAt.toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </time>
                    <form action={removeFavorite}>
                      <input type="hidden" name="id" value={f.id} />
                      <button
                        className="secondary"
                        aria-label={`Remover ${f.ticker}`}
                      >
                        Remover
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">
                Sua lista está vazia. Adicione um ticker para testar a
                persistência.
              </div>
            )}
          </>
        )}
      </section>
      <section className="panel">
        <h2>Análises recentes</h2>
        {runs.length ? (
          runs.map((r, i) => (
            <p key={i}>
              <Link href="/laboratorio">{r.name}</Link> ·{" "}
              {r.createdAt.toLocaleDateString("pt-BR")}
            </p>
          ))
        ) : (
          <p>Nenhum valuation salvo.</p>
        )}
      </section>
    </>
  );
}
