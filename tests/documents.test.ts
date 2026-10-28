import { readFile } from "node:fs/promises";
import { it, expect } from "vitest";
import { strToU8, zipSync } from "fflate";
import ExcelJS from "exceljs";
import { extract, chunks } from "../src/services/documents";
it("TXT/CSV preservam valores negativos e decimais", async () => {
  const r = await extract("a.csv", strToU8("conta;2025\nCaixa;-1.234,56"));
  expect(r.sections[0].text).toContain("-1.234,56");
  expect(chunks([{ location: "p1", text: "a".repeat(4000) }])).toHaveLength(3);
});
it("rejeita formato, PDF falso e ZIP incompatível", async () => {
  await expect(extract("a.exe", strToU8("abc"))).rejects.toThrow();
  await expect(extract("a.pdf", strToU8("abc"))).rejects.toThrow();
  await expect(extract("a.xlsx", strToU8("abc"))).rejects.toThrow();
});
it("XLSX não executa fórmula nem macro", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Balanço");
  ws.addRow(["Caixa", -1234.56]);
  ws.getCell("B2").value = { formula: "1+1", result: 2 };
  const r = await extract(
    "a.xlsx",
    new Uint8Array(await wb.xlsx.writeBuffer()),
  );
  expect(r.sections[0].text).toContain("-1234.56");
  expect(r.sections[0].text).toContain("Fórmula não executada");
});
it("EPUB preserva capítulo/autor e ignora scripts", async () => {
  const zip = zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(
      '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
    ),
    "book.opf": strToU8(
      '<package><metadata><dc:title>Livro autorizado de teste</dc:title><dc:creator>Autor teste</dc:creator></metadata><manifest><item id="c1" href="c1.xhtml"/></manifest><spine><itemref idref="c1"/></spine></package>',
    ),
    "c1.xhtml": strToU8(
      "<h1>Margem</h1><p>Teste autorizado.</p><script>alert(1)</script>",
    ),
  });
  const r = await extract("a.epub", zip);
  expect(r.author).toBe("Autor teste");
  expect(r.sections[0].location).toContain("Margem");
  expect(r.sections[0].text).not.toContain("alert");
});
it("rejeita ZIP com travessia de caminho", async () => {
  await expect(
    extract("a.epub", zipSync({ "../evil": strToU8("x") })),
  ).rejects.toThrow();
});

it("PDF real de fixture preserva páginas", async () => {
  const r = await extract(
    "teste.pdf",
    new Uint8Array(await readFile("tests/fixtures/relatorio-autorizado.pdf")),
  );
  expect(r.sections).toHaveLength(2);
  expect(r.sections[0].location).toBe("Página 1");
  expect(r.sections[0].text).toContain("-1234.56");
});
