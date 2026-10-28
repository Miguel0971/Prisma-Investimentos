import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { formulaSchema } from "./formula";
import { safeUnzip } from "./documents";
export async function importDefinition(name: string, bytes: Uint8Array) {
  if (bytes.length > 1_000_000) throw Error("Definição excede 1 MB.");
  const ext = name.split(".").at(-1)?.toLowerCase();
  if (ext === "json")
    return formulaSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  let rows: Record<string, string>[];
  if (ext === "csv") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    rows = parse(text, {
      columns: true,
      delimiter: text.split(/\r?\n/)[0].includes(";") ? ";" : ",",
      bom: true,
      skip_empty_lines: true,
      max_record_size: 10000,
    });
  } else if (ext === "xlsx") {
    const files = safeUnzip(bytes);
    if (Object.keys(files).some((k) => /vbaproject|externallinks/i.test(k)))
      throw Error("Macros/vínculos externos não permitidos.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as never);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 31)
      throw Error("Use uma aba com cabeçalho e até 30 variáveis.");
    const matrix: string[][] = [];
    sheet.eachRow((row) => {
      const line: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (
          cell.value &&
          typeof cell.value === "object" &&
          ("formula" in cell.value || "sharedFormula" in cell.value)
        )
          throw Error(
            `Fórmula Excel incompatível em ${cell.address}. Converta manualmente para a linguagem restrita.`,
          );
        line.push(cell.text);
      });
      matrix.push(line);
    });
    const headers = matrix.shift() ?? [];
    rows = matrix.map((line) =>
      Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""])),
    );
  } else throw Error("Importe JSON, CSV ou XLSX.");
  if (!rows.length || rows.length > 30)
    throw Error("Quantidade de variáveis inválida.");
  const first = rows[0];
  return formulaSchema.parse({
    name: first.formulaName,
    description: first.description ?? "",
    category: first.category,
    expression: first.expression,
    variables: rows.map((r) => ({
      name: r.name,
      label: r.label,
      unit: r.unit,
      ...(r.min ? { min: r.min } : {}),
      ...(r.max ? { max: r.max } : {}),
      ...(r.default ? { default: r.default } : {}),
    })),
  });
}
