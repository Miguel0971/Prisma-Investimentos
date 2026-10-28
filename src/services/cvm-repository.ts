import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { companies, officialDocuments, financialStatements } from "@/db/schema";
import {
  registryUrl,
  type Company,
  type OfficialDocument,
  type StatementRow,
} from "./cvm";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function persistOfficialPackage(
  company: Company,
  report: { docs: OfficialDocument[]; rows: StatementRow[]; source: string },
  type: string,
) {
  const database = db();
  await database
    .insert(companies)
    .values({ ...company, source: registryUrl })
    .onConflictDoUpdate({
      target: companies.cnpj,
      set: { ...company, source: registryUrl, updatedAt: new Date() },
    });
  // Append-only revisions: a changed source with the same reported version is preserved.
  for (let i = 0; i < report.docs.length; i += 200) {
    const rows = report.docs
      .slice(i, i + 200)
      .map((d) => ({
        companyCnpj: company.cnpj,
        externalId: d.externalId,
        recordHash: hash({
          title: d.title,
          category: d.category,
          reference: d.reference,
          published: d.published,
          version: d.version,
          url: d.url,
        }),
        title: d.title,
        category: d.category,
        reference: d.reference,
        published: d.published,
        version: d.version,
        url: d.url,
        source: d.source,
      }));
    await database.insert(officialDocuments).values(rows).onConflictDoNothing();
  }
  for (let i = 0; i < report.rows.length; i += 200) {
    const rows = report.rows
      .slice(i, i + 200)
      .map((r) => ({
        ...r,
        companyCnpj: company.cnpj,
        documentType: type,
        recordHash: hash({ company: company.cnpj, type, ...r }),
        source: report.source,
      }));
    await database
      .insert(financialStatements)
      .values(rows)
      .onConflictDoNothing();
  }
}
