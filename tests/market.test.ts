import { describe, it, expect, vi } from "vitest";
import { BrapiProvider, normalizeQuote } from "../src/services/market";
import { cached, type CacheStore } from "../src/services/cache";
import { sma, rsi, macd } from "../src/services/indicators";
// Dados sintéticos EXCLUSIVOS DE TESTE; não são cotações atuais.
const fixture = {
  results: [
    {
      symbol: "PETR4",
      currency: "BRL",
      regularMarketPrice: 30,
      regularMarketTime: "2025-01-03T20:00:00Z",
      marketState: "CLOSED",
      historicalDataPrice: [
        { date: 2, open: 30, high: 32, low: 29, close: 31 },
        { date: 1, open: 29, high: 31, low: 28, close: 30 },
      ],
    },
  ],
};
describe("mercado", () => {
  it("preserva origem/data, fechamento e ordena candles", () => {
    const q = normalizeQuote(fixture, "PETR4");
    expect(q.price).toBe(30);
    expect(q.marketState).toBe("CLOSED");
    expect(q.quotedAt).toBe("2025-01-03T20:00:00.000Z");
    expect(q.history.map((x) => x.time)).toEqual([1, 2]);
    expect(q.delay).toContain("Não é garantido");
  });
  it("não inventa ausentes", () => {
    expect(normalizeQuote(fixture, "PETR4").volume).toBeNull();
    expect(() => normalizeQuote({ results: [] }, "VALE3")).toThrow();
    expect(() =>
      normalizeQuote({ results: [{ symbol: "VALE3" }] }, "VALE3"),
    ).toThrow();
  });
  it.each([400, 401, 403, 404, 429, 500])("trata HTTP %i", async (status) => {
    const api = new BrapiProvider(
      "segredo",
      vi.fn(async () => new Response("", { status })),
    );
    await expect(api.quote("PETR4", "1mo")).rejects.toThrow();
  });
  it("usa autorização apenas no header e período validado", async () => {
    const mock = vi.fn<typeof fetch>(async () => Response.json(fixture));
    await new BrapiProvider("segredo", mock).quote("PETR4", "1d");
    expect(String(mock.mock.calls[0]?.[0])).not.toContain("segredo");
  });
  it("trata indisponibilidade", async () => {
    await expect(
      new BrapiProvider("", async () => {
        throw new Error("secret");
      }).quote("PETR4", "1y"),
    ).rejects.toThrow("Fornecedor indisponível");
  });
});
describe("cache", () => {
  it("TTL, deduplicação simultânea e recuperação após falha", async () => {
    let item: { value: unknown; expiresAt: Date } | undefined;
    let time = 0;
    const store: CacheStore = {
      get: async () => item,
      set: async (_, value, expiresAt) => {
        item = { value, expiresAt };
      },
    };
    const load = vi.fn(async () => 42);
    const flights = new Map();
    const get = () => cached(store, "x", 100, load, flights, () => time);
    expect(await Promise.all([get(), get()])).toEqual([42, 42]);
    expect(load).toHaveBeenCalledTimes(1);
    await get();
    expect(load).toHaveBeenCalledTimes(1);
    time = 101;
    await get();
    expect(load).toHaveBeenCalledTimes(2);
    await expect(
      cached(
        store,
        "bad",
        1,
        async () => {
          throw Error("bad");
        },
        flights,
        () => 500,
      ),
    ).rejects.toThrow();
    expect(flights.size).toBe(0);
  });
});
describe("indicadores", () => {
  it("MM e RSI conhecidos", () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    expect(rsi(Array.from({ length: 20 }, (_, i) => i)).at(-1)).toBe(100);
    expect(rsi(Array(20).fill(4)).at(-1)).toBe(50);
  });
  it("MACD constante e histórico insuficiente", () => {
    expect(macd(Array(40).fill(10)).histogram.at(-1)).toBe(0);
    expect(rsi([1, 2])).toEqual([null, null]);
  });
});
