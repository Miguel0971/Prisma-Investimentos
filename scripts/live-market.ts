import { BrapiProvider } from "../src/services/market";
async function main() {
  for (const ticker of ["PETR4", "VALE3"]) {
    try {
      const result = await new BrapiProvider(process.env.BRAPI_TOKEN).quote(
        ticker,
        "1mo",
      );
      console.log(
        JSON.stringify({
          ticker: result.symbol,
          price: result.price,
          quotedAt: result.quotedAt,
          fetchedAt: result.fetchedAt,
          points: result.history.length,
          source: result.source,
        }),
      );
    } catch (e) {
      console.error(ticker, e instanceof Error ? e.message : "Falha");
      process.exitCode = 1;
    }
  }
}
void main();
