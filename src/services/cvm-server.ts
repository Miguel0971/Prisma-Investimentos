import "server-only";
import { persistOfficialPackage } from "./cvm-repository";
import { cached } from "./cache";
import { cacheStore } from "./market-server";
import {
  companiesFromCsv,
  officialBytes,
  registryUrl,
  getOfficialPackage,
  type cvmType,
} from "./cvm";
import type { z } from "zod";
const flights = new Map<string, Promise<unknown>>();
export async function findCompanies(query: string) {
  const all = await cached(
    cacheStore,
    "cvm:registry",
    86400_000,
    async () => companiesFromCsv(await officialBytes(registryUrl)),
    flights,
  );
  const q = query.toLowerCase();
  return all
    .filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.cnpj.includes(q.replace(/\D/g, "") || "NO_MATCH"),
    )
    .slice(0, 50);
}
export function companyPackage(
  cnpj: string,
  type: z.infer<typeof cvmType>,
  year: number,
  statement: string,
  scope: string,
) {
  return cached(
    cacheStore,
    `cvm:v2:${cnpj}:${type}:${year}:${statement}:${scope}`,
    86400_000,
    () => refreshCompanyPackage(cnpj, type, year, statement, scope),
    flights,
  );
}

export async function refreshCompanyPackage(
  cnpj: string,
  type: z.infer<typeof cvmType>,
  year: number,
  statement = "DRE",
  scope = "con",
) {
  const matches = await findCompanies(cnpj);
  const company = matches.find((c) => c.cnpj === cnpj);
  if (!company) throw Error("CNPJ não encontrado no cadastro oficial.");
  const report = await getOfficialPackage(cnpj, type, year, statement, scope);
  await persistOfficialPackage(company, report, type);
  return { ...report, company };
}
