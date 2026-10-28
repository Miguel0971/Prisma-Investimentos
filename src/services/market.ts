import { z } from "zod";
import { tickerSchema } from "../lib/policy";
import { fetchJson, ServiceError, type Fetcher } from "./http";
export const ranges = ["1d", "5d", "1mo", "6mo", "1y", "5y", "max"] as const;
export const rangeSchema = z.enum(ranges);
export type Range = (typeof ranges)[number];
const nullable = z.number().finite().nullish();
const candleSchema = z.object({
  date: z.number().int().positive(),
  open: nullable,
  high: nullable,
  low: nullable,
  close: nullable,
  volume: nullable,
  adjustedClose: nullable,
});
const quoteSchema = z.object({
  symbol: z.string(),
  longName: z.string().nullish(),
  shortName: z.string().nullish(),
  currency: z.string(),
  regularMarketPrice: z.number().finite().nonnegative(),
  regularMarketTime: z.union([z.string(), z.number()]),
  regularMarketChange: nullable,
  regularMarketChangePercent: nullable,
  regularMarketDayHigh: nullable,
  regularMarketDayLow: nullable,
  regularMarketVolume: nullable,
  marketState: z.string().nullish(),
  historicalDataPrice: z.array(candleSchema).max(50000).optional(),
});
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  adjustedClose: number | null;
};
export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  quotedAt: string;
  fetchedAt: string;
  source: string;
  marketState: string;
  delay: string;
  history: Candle[];
};
export interface MarketProvider {
  quote(ticker: string, range: Range): Promise<Quote>;
  search(query: string): Promise<{ ticker: string; name: string }[]>;
}
export function normalizeQuote(
  raw: unknown,
  requested: string,
  now = new Date(),
): Quote {
  const parsed = z.object({ results: z.array(quoteSchema) }).safeParse(raw);
  if (!parsed.success)
    throw new ServiceError(
      "FORMAT",
      "Cotação incompleta ou formato não reconhecido.",
    );
  const q = parsed.data.results.find((x) => x.symbol === requested);
  if (!q)
    throw new ServiceError(
      "NOT_FOUND",
      "Ativo não retornado pelo fornecedor.",
      404,
    );
  const date = new Date(
    typeof q.regularMarketTime === "number"
      ? q.regularMarketTime * 1000
      : q.regularMarketTime,
  );
  if (!Number.isFinite(date.getTime()))
    throw new ServiceError("FORMAT", "Data da cotação inválida.");
  const points = new Map<number, Candle>();
  for (const c of q.historicalDataPrice ?? []) {
    if (c.open == null || c.high == null || c.low == null || c.close == null)
      continue;
    if (
      c.low > Math.min(c.open, c.close) ||
      c.high < Math.max(c.open, c.close) ||
      c.low < 0
    )
      continue;
    points.set(c.date, {
      time: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? null,
      adjustedClose: c.adjustedClose ?? null,
    });
  }
  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName ?? q.symbol,
    currency: q.currency,
    price: q.regularMarketPrice,
    change: q.regularMarketChange ?? null,
    changePercent: q.regularMarketChangePercent ?? null,
    high: q.regularMarketDayHigh ?? null,
    low: q.regularMarketDayLow ?? null,
    volume: q.regularMarketVolume ?? null,
    quotedAt: date.toISOString(),
    fetchedAt: now.toISOString(),
    source: "Brapi",
    marketState: q.marketState ?? "Não informado pelo fornecedor",
    delay: "Não é garantido tempo real. Atraso não informado pelo fornecedor.",
    history: [...points.values()].sort((a, b) => a.time - b.time),
  };
}
export class BrapiProvider implements MarketProvider {
  constructor(
    private token?: string,
    private fetcher: Fetcher = fetch,
  ) {}
  async quote(ticker: string, range: Range) {
    const symbol = tickerSchema.parse(ticker);
    rangeSchema.parse(range);
    const url = new URL(`https://brapi.dev/api/quote/${symbol}`);
    url.searchParams.set("range", range);
    url.searchParams.set(
      "interval",
      range === "1d" ? "5m" : range === "5d" ? "30m" : "1d",
    );
    return normalizeQuote(
      await fetchJson(url, this.token, this.fetcher),
      symbol,
    );
  }
  async search(query: string) {
    const term = z.string().trim().min(2).max(80).parse(query);
    const url = new URL("https://brapi.dev/api/quote/list");
    url.searchParams.set("search", term);
    url.searchParams.set("limit", "20");
    const data = z
      .object({
        stocks: z
          .array(z.object({ stock: z.string(), name: z.string() }))
          .max(100),
      })
      .safeParse(await fetchJson(url, this.token, this.fetcher));
    if (!data.success)
      throw new ServiceError(
        "FORMAT",
        "Busca indisponível: resposta inesperada.",
      );
    return data.data.stocks.map((x) => ({ ticker: x.stock, name: x.name }));
  }
}
