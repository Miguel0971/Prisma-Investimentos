import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import {
  formulas,
  formulaVersions,
  valuationRuns,
  financialStatements,
  companies,
} from "@/db/schema";
import { owner } from "@/lib/owner";
import { formulaSchema } from "@/services/formula";
import { FormulaLab } from "@/components/formula-lab";
import { dateTime } from "@/lib/format";
export default async function Lab() {
  const user = await owner();
  const saved = await db()
    .select({
      id: formulas.id,
      versionId: formulaVersions.id,
      version: formulaVersions.version,
      definition: formulaVersions.definition,
    })
    .from(formulaVersions)
    .innerJoin(formulas, eq(formulas.id, formulaVersions.formulaId))
    .where(and(eq(formulas.userId, user.id), eq(formulas.archived, false)))
    .orderBy(desc(formulaVersions.createdAt));
  const runs = await db()
    .select()
    .from(valuationRuns)
    .where(eq(valuationRuns.userId, user.id))
    .orderBy(desc(valuationRuns.createdAt))
    .limit(30);
  const accounts = await db()
    .select({
      id: financialStatements.id,
      name: companies.name,
      label: financialStatements.label,
      code: financialStatements.code,
      period: financialStatements.period,
      reference: financialStatements.reference,
      version: financialStatements.version,
      scale: financialStatements.scale,
      group: financialStatements.group,
    })
    .from(financialStatements)
    .innerJoin(companies, eq(companies.cnpj, financialStatements.companyCnpj))
    .where(eq(financialStatements.currency, "REAL"))
    .orderBy(desc(financialStatements.firstSeenAt))
    .limit(300);
  return (
    <>
      <span className="eyebrow">PREMISSAS EXPLÍCITAS</span>
      <h1>Laboratório de fórmulas</h1>
      <FormulaLab
        accounts={accounts.map((a) => ({
          id: a.id,
          label: `${a.name} · ${a.code} ${a.label} · ${a.group} · fim ${a.period} / ref. ${a.reference} · v${a.version} · ${a.scale}`,
        }))}
        saved={saved.map((x) => ({
          ...x,
          definition: formulaSchema.parse(x.definition),
        }))}
      />
      <section className="panel">
        <h2>Histórico de análises</h2>
        {runs.length ? (
          runs.map((r) => (
            <details key={r.id}>
              <summary>
                {r.name} · {dateTime(r.createdAt)}
              </summary>
              <pre>
                {JSON.stringify(
                  { premissas: r.inputs, resultado: r.result },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))
        ) : (
          <p>Nenhum cálculo salvo.</p>
        )}
      </section>
    </>
  );
}
