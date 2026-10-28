import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { importDefinition } from "../src/services/formula-import";
it("importa CSV com variáveis e unidades", async () => {
  const f = await importDefinition(
    "modelo.csv",
    new Uint8Array(await readFile("tests/fixtures/formula-modelo.csv")),
  );
  expect(f.expression).toBe("valor / acoes");
  expect(f.variables[1].unit).toBe("acoes");
});
it("recusa fórmulas Excel em vez de executá-las", async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Modelo");
  sheet.addRow(["expression"]);
  sheet.getCell("A2").value = { formula: 'HYPERLINK("https://evil")' };
  await expect(
    importDefinition(
      "modelo.xlsx",
      new Uint8Array(await wb.xlsx.writeBuffer()),
    ),
  ).rejects.toThrow("incompatível");
});
