import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
export const extensions = ["pdf", "epub", "xlsx", "csv", "txt", "md"] as const;
export type Section = { location: string; text: string };
export type Extracted = {
  title?: string;
  author?: string;
  sections: Section[];
};
export const maxFileSize = 20 * 1024 * 1024;
export function extension(name: string) {
  const ext = name.toLowerCase().split(".").at(-1) ?? "";
  if (!(extensions as readonly string[]).includes(ext))
    throw Error("Formato não permitido. Use PDF, EPUB, XLSX, CSV, TXT ou MD.");
  return ext;
}
function text(bytes: Uint8Array) {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (value.includes("\0"))
    throw Error("Conteúdo binário incompatível com texto.");
  return value;
}
export function safeUnzip(bytes: Uint8Array) {
  let total = 0,
    count = 0,
    invalid = false;
  const files = unzipSync(bytes, {
    filter: (e) => {
      count++;
      total += e.originalSize;
      if (
        count > 1000 ||
        total > 40_000_000 ||
        e.originalSize > 20_000_000 ||
        e.name.includes("..") ||
        e.name.startsWith("/")
      ) {
        invalid = true;
        return false;
      }
      return true;
    },
  });
  if (invalid) throw Error("ZIP excede limites ou contém caminho inválido.");
  return files;
}
function plainHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
export async function extract(
  name: string,
  bytes: Uint8Array,
): Promise<Extracted> {
  if (bytes.length === 0 || bytes.length > maxFileSize)
    throw Error("Arquivo vazio ou maior que 20 MB.");
  const ext = extension(name);
  const result: Extracted = { sections: [] };
  if (ext === "pdf") {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw Error("Assinatura PDF inválida.");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: bytes.slice(),
      useSystemFonts: false,
      disableFontFace: true,
      stopAtErrors: true,
    });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > 300)
        throw Error("Limite de 300 páginas; divida o PDF.");
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const value = content.items
          .map((x) => ("str" in x ? x.str : ""))
          .join(" ");
        if (value.trim())
          result.sections.push({ location: `Página ${n}`, text: value });
        page.cleanup();
      }
    } finally {
      await task.destroy();
    }
    if (!result.sections.length)
      throw Error(
        "PDF sem texto extraível. OCR necessário; OCR não configurado.",
      );
  } else if (ext === "epub") {
    const files = safeUnzip(bytes);
    if (
      !files.mimetype ||
      text(files.mimetype).trim() !== "application/epub+zip"
    )
      throw Error("EPUB inválido.");
    if (files["META-INF/encryption.xml"])
      throw Error("EPUB criptografado/DRM não suportado.");
    const xml = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
    });
    const container = xml.parse(
      text(files["META-INF/container.xml"] ?? new Uint8Array()),
    );
    const root = container?.container?.rootfiles?.rootfile;
    const opf = Array.isArray(root)
      ? root[0]?.["@_full-path"]
      : root?.["@_full-path"];
    if (typeof opf !== "string" || !files[opf])
      throw Error("Estrutura EPUB inválida.");
    const pack = xml.parse(text(files[opf])).package;
    const metadata = pack.metadata ?? {};
    result.title = String(
      metadata["dc:title"]?.["#text"] ?? metadata["dc:title"] ?? name,
    );
    result.author = String(
      metadata["dc:creator"]?.["#text"] ??
        metadata["dc:creator"] ??
        "Não identificado",
    );
    const manifest = Array.isArray(pack.manifest.item)
      ? pack.manifest.item
      : [pack.manifest.item];
    const spine = Array.isArray(pack.spine.itemref)
      ? pack.spine.itemref
      : [pack.spine.itemref];
    const base = opf.includes("/")
      ? opf.slice(0, opf.lastIndexOf("/") + 1)
      : "";
    for (const [i, ref] of spine.entries()) {
      const entry = manifest.find(
        (x: Record<string, string>) => x["@_id"] === ref["@_idref"],
      );
      if (!entry) continue;
      const path = base + entry["@_href"];
      if (!files[path]) continue;
      const html = text(files[path]);
      const title = plainHtml(
        html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ??
          `Capítulo ${i + 1}`,
      );
      result.sections.push({
        location: `Capítulo ${i + 1}: ${title}`,
        text: plainHtml(html),
      });
    }
  } else if (ext === "xlsx") {
    const files = safeUnzip(bytes);
    if (
      !files["xl/workbook.xml"] ||
      Object.keys(files).some((k) => /vbaproject|externallinks/i.test(k))
    )
      throw Error("XLSX inválido, macros ou vínculos externos não permitidos.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as never);
    let cells = 0;
    workbook.eachSheet((sheet) => {
      let lines: string[] = [];
      let first = 1;
      sheet.eachRow((row, n) => {
        if (row.cellCount > 200) throw Error("Planilha excede 200 colunas.");
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (++cells > 50000) throw Error("Planilha excede 50 mil células.");
          const val = cell.value;
          let rendered = cell.text;
          if (val && typeof val === "object" && "formula" in val)
            rendered = `[Fórmula não executada: ${val.formula}; resultado em cache: ${String(val.result ?? "ausente")}]`;
          values.push(`${col}: ${rendered}`);
        });
        lines.push(`Linha ${n}: ${values.join(" | ")}`);
        if (lines.join("").length > 6000) {
          result.sections.push({
            location: `Planilha ${sheet.name}, linhas ${first}–${n}`,
            text: lines.join("\n"),
          });
          lines = [];
          first = n + 1;
        }
      });
      if (lines.length)
        result.sections.push({
          location: `Planilha ${sheet.name}, a partir da linha ${first}`,
          text: lines.join("\n"),
        });
    });
  } else if (ext === "csv") {
    const value = text(bytes);
    const delimiter = value.split(/\r?\n/)[0].includes(";") ? ";" : ",";
    const rows = parse(value, {
      delimiter,
      bom: true,
      skip_empty_lines: true,
      max_record_size: 100000,
    }) as string[][];
    if (rows.length > 10000) throw Error("CSV excede 10 mil linhas.");
    for (let i = 0; i < rows.length; i += 40)
      result.sections.push({
        location: `CSV linhas ${i + 1}–${Math.min(i + 40, rows.length)}`,
        text: rows
          .slice(i, i + 40)
          .map((r, j) => `Linha ${i + j + 1}: ${r.join(" | ")}`)
          .join("\n"),
      });
  } else {
    result.sections = [{ location: "Texto completo", text: text(bytes) }];
  }
  if (result.sections.reduce((n, s) => n + s.text.length, 0) > 600000)
    throw Error("Conteúdo excede 600 mil caracteres; divida o documento.");
  if (!result.sections.some((s) => s.text.trim()))
    throw Error("Nenhum texto extraído.");
  return result;
}
export function chunks(sections: Section[], size = 1800, overlap = 150) {
  if (size <= overlap) throw Error("Tamanho de chunk inválido.");
  const out: Section[] = [];
  for (const section of sections) {
    for (let start = 0; start < section.text.length; start += size - overlap) {
      const value = section.text.slice(start, start + size);
      if (value.trim()) out.push({ location: section.location, text: value });
      if (start + size >= section.text.length) break;
    }
  }
  if (out.length > 600) throw Error("Documento excede 600 trechos.");
  return out;
}
