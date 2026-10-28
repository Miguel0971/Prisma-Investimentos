import Link from "next/link";
import { consume } from "@/services/limits";
import { requireOwner } from "@/lib/auth";
import { marketQuote, marketSearch } from "@/services/market-server";
import { rangeSchema, ranges } from "@/services/market";
import { tickerSchema } from "@/lib/policy";
import { ServiceError } from "@/services/http";
import { PriceChart } from "@/components/price-chart";
import { money, number, dateTime } from "@/lib/format";
export default async function Market({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; periodo?: string }>;
}) {
  const session = await requireOwner();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 80);
  const range = rangeSchema.catch("1mo").parse(params.periodo);
  let quote;
  let results;
  let error;
  if (query) {
    try {
      await consume(`market:${session.githubId}`, 1, 40, 60_000);
      const ticker = tickerSchema.safeParse(query);
      if (ticker.success) quote = await marketQuote(ticker.data, range);
      else results = await marketSearch(query);
    } catch (e) {
      error =
        e instanceof ServiceError
          ? e.message
          : "Não foi possível consultar mercado. Verifique banco e integração.";
    }
  }
  return (
    <>
      <span className="eyebrow">MERCADO BRASILEIRO</span>
      <h1>Explorar e analisar ações</h1>
      <form className="toolbar">
        <label htmlFor="busca">Ticker ou nome da companhia</label>
        <input
          id="busca"
          name="q"
          defaultValue={query}
          placeholder="PETR4, VALE3 ou nome"
          required
          maxLength={80}
        />
        <button>Pesquisar</button>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {results && (
        <section className="panel">
          <h2>Resultados</h2>
          {results.length ? (
            results.map((r) => (
              <p key={r.ticker}>
                <Link href={`/mercado?q=${encodeURIComponent(r.ticker)}`}>
                  {r.ticker} — {r.name}
                </Link>
              </p>
            ))
          ) : (
            <p>Nenhuma companhia retornada.</p>
          )}
        </section>
      )}
      {quote && (
        <>
          <div className="section-heading">
            <div>
              <h2>{quote.symbol}</h2>
              <p>{quote.name}</p>
            </div>
            <strong className="metric">
              {money(quote.price, quote.currency)}
            </strong>
          </div>
          <div className="cards">
            <section className="panel">
              Variação
              <p>
                {money(quote.change, quote.currency)} ·{" "}
                {number(quote.changePercent)}%
              </p>
            </section>
            <section className="panel">
              Máxima / mínima diária
              <p>
                {money(quote.high, quote.currency)} /{" "}
                {money(quote.low, quote.currency)}
              </p>
            </section>
            <section className="panel">
              Volume negociado<p>{number(quote.volume)}</p>
            </section>
          </div>
          <section className="panel">
            <nav className="tabs" aria-label="Período">
              {ranges.map((r) => (
                <Link
                  aria-current={r === range ? "page" : undefined}
                  key={r}
                  href={`/mercado?q=${quote.symbol}&periodo=${r}`}
                >
                  {
                    {
                      "1d": "1 dia",
                      "5d": "5 dias",
                      "1mo": "1 mês",
                      "6mo": "6 meses",
                      "1y": "1 ano",
                      "5y": "5 anos",
                      max: "Máximo",
                    }[r]
                  }
                </Link>
              ))}
            </nav>
            <PriceChart history={quote.history} />
          </section>
          <div className="notice">
            Fonte: {quote.source} · Cotação: {dateTime(quote.quotedAt)} ·
            Consulta: {dateTime(quote.fetchedAt)}
            <br />
            Mercado: {quote.marketState}. {quote.delay} Cache: até 60 segundos.
          </div>
          <Link
            className="button-link"
            href={`/laboratorio?ticker=${quote.symbol}`}
          >
            Abrir laboratório de valuation →
          </Link>
        </>
      )}
      {!query && (
        <p>
          Digite um ativo para consultar o fornecedor. Nenhum preço é simulado.
        </p>
      )}
    </>
  );
}
