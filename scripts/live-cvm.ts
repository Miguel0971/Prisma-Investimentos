import { getOfficialPackage } from "../src/services/cvm";
async function main() {
  const currentYear = new Date().getFullYear();
  for (const [type, year] of [
    ["DFP", currentYear - 1],
    ["ITR", currentYear],
    ["FRE", currentYear],
    ["IPE", currentYear],
  ] as const) {
    try {
      const r = await getOfficialPackage(
        "33000167000101",
        type,
        year,
        "DRE",
        "con",
      );
      console.log(
        JSON.stringify({
          type,
          year,
          source: r.source,
          fetchedAt: r.fetchedAt,
          documents: r.docs.length,
          rows: r.rows.length,
          firstDocument: r.docs[0],
          firstRow: r.rows[0],
        }),
      );
      if (!r.docs.length) throw Error("Nenhum documento Petrobras encontrado.");
    } catch (e) {
      console.error(
        type,
        e instanceof Error ? e.message : "Erro de integração",
      );
      process.exitCode = 1;
    }
  }
}
void main();
