import { parse } from "csv-parse";
import { unzipSync } from "fflate";
import { z } from "zod";
import { ServiceError, readLimited, type Fetcher } from "./http";
export const cvmType = z.enum(["DFP", "ITR", "FRE", "IPE"]);
export const yearSchema = z.coerce
  .number()
  .int()
  .min(2010)
  .max(new Date().getFullYear());
export const cnpjSchema = z
  .string()
  .transform((x) => x.replace(/[^0-9]/g, ""))
  .pipe(z.string().regex(/^\d{14}$/));
export type Company = {
  cnpj: string;
  name: string;
  cvmCode: string;
  sector: string;
  website: string | null;
  status: string;
};
export type OfficialDocument = {
  externalId: string;
  title: string;
  cnpj: string;
  category: string;
  reference: string | null;
  published: string | null;
  version: string;
  url: string | null;
  source: string;
};
export type StatementRow = {
  code: string;
  label: string;
  value: string;
  currency: string;
  scale: string;
  period: string;
  reference: string;
  version: string;
  exercise: string;
  group: string;
};
export function safeOfficialLink(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      !/(^|\.)cvm\.gov\.br$/.test(u.hostname)
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
export function safeWebLink(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(/^https?:/.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export async function* csvRecords(bytes: Uint8Array) {
  const text = new TextDecoder("windows-1252").decode(bytes);
  const parser = parse(text, {
    columns: true,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    max_record_size: 200000,
  });
  for await (const row of parser) yield row as Record<string, string>;
}
export function unzipSelected(
  bytes: Uint8Array,
  name: string,
  max = 40_000_000,
) {
  let tooLarge = false;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      if (entry.name !== name) return false;
      if (entry.originalSize > max) {
        tooLarge = true;
        return false;
      }
      return true;
    },
  });
  if (tooLarge)
    throw new ServiceError(
      "SIZE",
      "Arquivo CVM excede o limite de processamento.",
    );
  if (!files[name])
    throw new ServiceError(
      "MISSING",
      "Arquivo não encontrado no pacote oficial.",
    );
  return files[name];
}
export async function officialBytes(url: string, fetcher: Fetcher = fetch) {
  let r: Response;
  try {
    r = await fetcher(url, {
      signal: AbortSignal.timeout(25000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new ServiceError("NETWORK", "CVM indisponível ou tempo excedido.");
  }
  if (!r.ok)
    throw new ServiceError(
      "CVM_HTTP",
      r.status === 404
        ? "CVM não publicou este pacote/ano."
        : "CVM indisponível.",
    );
  return readLimited(r, 30_000_000);
}
export const registryUrl =
  "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";
export async function companiesFromCsv(bytes: Uint8Array) {
  const out: Company[] = [];
  for await (const r of csvRecords(bytes)) {
    const cnpj = cnpjSchema.safeParse(r.CNPJ_CIA);
    if (cnpj.success)
      out.push({
        cnpj: cnpj.data,
        name: r.DENOM_SOCIAL,
        cvmCode: r.CD_CVM,
        sector: r.SETOR_ATIV ?? "",
        website: safeWebLink(r.WEB_SITE),
        status: r.SIT ?? "",
      });
  }
  return out;
}
export async function documentIndex(
  bytes: Uint8Array,
  cnpj: string,
  type: string,
  source: string,
) {
  const out: OfficialDocument[] = [];
  for await (const r of csvRecords(bytes)) {
    if ((r.CNPJ_CIA ?? r.CNPJ_Companhia ?? "").replace(/\D/g, "") !== cnpj)
      continue;
    const id =
      r.ID_DOC ||
      r.Protocolo_Entrega ||
      r.NUM_PROTOCOLO ||
      r.LINK_DOC ||
      r.Link_Download;
    if (!id) continue;
    const version = r.VERSAO || r.Versao || "1";
    out.push({
      externalId: `${type}:${id}:${version}`,
      title: r.Assunto || r.ASSUNTO || r.Tipo || r.CATEG_DOC || type,
      cnpj,
      category: r.Categoria || r.CATEG_DOC || type,
      reference: r.DT_REFER || r.Data_Referencia || null,
      published: r.DT_RECEB || r.Data_Entrega || null,
      version,
      url: safeOfficialLink(r.LINK_DOC || r.Link_Download),
      source,
    });
  }
  return out.sort((a, b) =>
    (b.published ?? "").localeCompare(a.published ?? ""),
  );
}
export function packageUrl(type: string, year: number) {
  cvmType.parse(type);
  yearSchema.parse(year);
  return `https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/${type}/DADOS/${type.toLowerCase()}_cia_aberta_${year}.zip`;
}
export async function getOfficialPackage(
  cnpj: string,
  type: z.infer<typeof cvmType>,
  year: number,
  statement = "DRE",
  scope = "con",
  fetcher: Fetcher = fetch,
) {
  cnpj = cnpjSchema.parse(cnpj);
  z.enum(["DRE", "BPA", "BPP", "DFC_MD", "DFC_MI"]).parse(statement);
  z.enum(["con", "ind"]).parse(scope);
  const source = packageUrl(type, year);
  const bytes = await officialBytes(source, fetcher);
  const prefix = `${type.toLowerCase()}_cia_aberta`;
  const docs = await documentIndex(
    unzipSelected(bytes, `${prefix}_${year}.csv`),
    cnpj,
    type,
    source,
  );
  const rows: StatementRow[] = [];
  if (type === "DFP" || type === "ITR") {
    let data: Uint8Array;
    try {
      data = unzipSelected(
        bytes,
        `${prefix}_${statement}_${scope}_${year}.csv`,
      );
    } catch (e) {
      if (e instanceof ServiceError && e.code === "MISSING")
        return { docs, rows, source, fetchedAt: new Date().toISOString() };
      throw e;
    }
    for await (const r of csvRecords(data)) {
      if ((r.CNPJ_CIA ?? r.CNPJ_Companhia ?? "").replace(/\D/g, "") !== cnpj)
        continue;
      if (!/^-?\d+(\.\d+)?$/.test(r.VL_CONTA ?? ""))
        throw new ServiceError("FORMAT", "Valor contábil inválido na fonte.");
      rows.push({
        code: r.CD_CONTA,
        label: r.DS_CONTA,
        value: r.VL_CONTA,
        currency: r.MOEDA,
        scale: r.ESCALA_MOEDA,
        period: r.DT_FIM_EXERC,
        reference: r.DT_REFER,
        version: r.VERSAO,
        exercise: r.ORDEM_EXERC,
        group: r.GRUPO_DFP || r.GRUPO_ITR,
      });
      if (rows.length > 5000)
        throw new ServiceError("SIZE", "Seleção excede 5 mil linhas.");
    }
  }
  return { docs, rows, source, fetchedAt: new Date().toISOString() };
}
