"use server";
import { z } from "zod";
import { and, eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { owner } from "@/lib/owner";
import { db } from "@/db";
import {
  formulas,
  formulaVersions,
  valuationRuns,
  financialStatements,
} from "@/db/schema";
import { formulaSchema, runFormula, type Formula } from "@/services/formula";
import {
  dcf,
  dcfScenarios,
  sensitivity,
  presets,
  validatePreset,
} from "@/services/valuation";
import { statementReais } from "@/services/financial-bindings";
import { withLease } from "@/services/leases";

export async function saveFormula(raw: unknown, values: unknown, id?: string) {
  const user = await owner();
  const f = formulaSchema.parse(raw);
  runFormula(f, values);
  const database = db();
  if (id) {
    z.string().uuid().parse(id);
    await withLease(`formula:${id}`, 30000, async () => {
      const [owned] = await database
        .select()
        .from(formulas)
        .where(and(eq(formulas.id, id), eq(formulas.userId, user.id)));
      if (!owned) throw Error("Fórmula não encontrada.");
      const [last] = await database
        .select()
        .from(formulaVersions)
        .where(eq(formulaVersions.formulaId, id))
        .orderBy(desc(formulaVersions.version))
        .limit(1);
      await database
        .insert(formulaVersions)
        .values({
          formulaId: id,
          version: (last?.version ?? 0) + 1,
          definition: f,
        });
    });
  } else {
    const newId = crypto.randomUUID();
    await database.batch([
      database
        .insert(formulas)
        .values({ id: newId, userId: user.id, name: f.name }),
      database
        .insert(formulaVersions)
        .values({ formulaId: newId, version: 1, definition: f }),
    ]);
  }
  revalidatePath("/laboratorio");
  return { message: "Versão salva. Resultados anteriores preservados." };
}
export async function archiveFormula(id: string) {
  const user = await owner();
  z.string().uuid().parse(id);
  await db()
    .update(formulas)
    .set({ archived: true })
    .where(and(eq(formulas.id, id), eq(formulas.userId, user.id)));
  revalidatePath("/laboratorio");
}

export async function calculate(
  kind: string,
  values: unknown,
  versionId?: string,
  bindingInput: unknown = {},
) {
  const user = await owner();
  const database = db();
  let definition: Formula | undefined;
  let name = kind;
  if (versionId) {
    z.string().uuid().parse(versionId);
    const [row] = await database
      .select({ definition: formulaVersions.definition })
      .from(formulaVersions)
      .innerJoin(formulas, eq(formulas.id, formulaVersions.formulaId))
      .where(
        and(eq(formulaVersions.id, versionId), eq(formulas.userId, user.id)),
      );
    if (!row) throw Error("Fórmula não encontrada.");
    definition = formulaSchema.parse(row.definition);
    name = definition.name;
  } else if (kind !== "DCF") {
    definition = presets.find((f) => f.name === kind);
    if (!definition) throw Error("Método desconhecido.");
  }
  const raw = z
    .record(
      z.string().max(30),
      z.union([z.string().max(60), z.number().finite()]),
    )
    .parse(values);
  const resolved = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, String(value)]),
  );
  const bindings = z
    .record(z.string().max(30), z.string().uuid())
    .parse(bindingInput);
  if (Object.keys(bindings).length > 30)
    throw Error("Muitos vínculos contábeis.");
  const sources: Record<string, unknown> = {};
  if (Object.keys(bindings).length) {
    const allowed = definition
      ? definition.variables.filter((v) => v.unit === "BRL").map((v) => v.name)
      : ["fcf", "netDebt"];
    const rows = await database
      .select()
      .from(financialStatements)
      .where(
        inArray(financialStatements.id, [...new Set(Object.values(bindings))]),
      );
    for (const [variable, id] of Object.entries(bindings)) {
      if (!allowed.includes(variable))
        throw Error(
          "Vinculação permitida somente a variáveis monetárias em BRL.",
        );
      const row = rows.find((r) => r.id === id);
      if (!row) throw Error("Conta contábil não encontrada.");
      resolved[variable] = statementReais(row);
      sources[variable] = {
        id: row.id,
        cnpj: row.companyCnpj,
        account: row.code,
        label: row.label,
        group: row.group,
        period: row.period,
        reference: row.reference,
        version: row.version,
        originalValue: row.value,
        originalScale: row.scale,
        originalCurrency: row.currency,
        resolvedReais: resolved[variable],
        source: row.source,
        recordHash: row.recordHash,
        selection:
          "Conta escolhida pelo usuário; adequação ao método exige revisão.",
      };
    }
  }
  let result: Record<string, unknown>;
  if (!definition) {
    const base = dcf(resolved);
    if (Object.keys(sources).length)
      base.source =
        "Premissas manuais e contas CVM explicitamente selecionadas. Conversão de MIL para BRL preservada nas origens.";
    result = {
      base,
      scenarios: dcfScenarios(resolved),
      sensitivity: sensitivity(resolved),
      sources,
    };
  } else {
    if (!versionId) validatePreset(definition, resolved);
    result = {
      ...runFormula(definition, resolved),
      sources,
      source: Object.keys(sources).length
        ? "Premissas manuais e contas CVM selecionadas; cálculo determinístico."
        : "Premissas manuais; cálculo determinístico.",
    };
  }
  await database
    .insert(valuationRuns)
    .values({
      userId: user.id,
      versionId,
      name,
      inputs: { manual: values, resolved, sources },
      result,
    });
  revalidatePath("/laboratorio");
  return { name, result };
}
export async function importFormula(form: FormData) {
  await owner();
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 1_000_000)
    throw Error("Arquivo inválido ou maior que 1 MB.");
  const { importDefinition } = await import("@/services/formula-import");
  return importDefinition(file.name, new Uint8Array(await file.arrayBuffer()));
}
