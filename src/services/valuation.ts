import Decimal from "decimal.js";
import { z } from "zod";
import { decimalSchema, type Formula } from "./formula";
export const dcfSchema = z
  .object({
    fcf: decimalSchema,
    growth: decimalSchema,
    years: z.coerce.number().int().min(1).max(30),
    wacc: decimalSchema,
    terminal: decimalSchema,
    netDebt: decimalSchema,
    shares: decimalSchema,
    price: decimalSchema.optional(),
  })
  .strict();
export function dcf(raw: unknown) {
  const a = dcfSchema.parse(raw);
  const fcf = new Decimal(a.fcf),
    growth = new Decimal(a.growth),
    wacc = new Decimal(a.wacc),
    terminal = new Decimal(a.terminal),
    shares = new Decimal(a.shares);
  if (
    wacc.lte(terminal) ||
    wacc.lte(0) ||
    wacc.gt(1) ||
    growth.lte(-1) ||
    growth.gt(1) ||
    terminal.lte(-1) ||
    terminal.gt("0.2") ||
    shares.lte(0)
  )
    throw Error(
      "Exige WACC > crescimento terminal, WACC entre 0 e 1, crescimento entre -1 e 1, terminal até 0,2 e ações > 0.",
    );
  let total = new Decimal(0);
  const projections = [];
  for (let year = 1; year <= a.years; year++) {
    const cash = fcf.mul(growth.add(1).pow(year));
    const present = cash.div(wacc.add(1).pow(year));
    total = total.add(present);
    projections.push({ year, fcf: cash.toFixed(), present: present.toFixed() });
  }
  const terminalValue = new Decimal(projections.at(-1)!.fcf)
    .mul(terminal.add(1))
    .div(wacc.sub(terminal));
  const terminalPresent = terminalValue.div(wacc.add(1).pow(a.years));
  const enterprise = total.add(terminalPresent),
    equity = enterprise.sub(a.netDebt),
    perShare = equity.div(shares);
  const price = a.price ? new Decimal(a.price) : null;
  if (price && price.lte(0))
    throw Error("Cotação de referência deve ser positiva.");
  return {
    projections,
    terminalValue: terminalValue.toFixed(),
    terminalPresent: terminalPresent.toFixed(),
    enterprise: enterprise.toFixed(),
    equity: equity.toFixed(),
    perShare: perShare.toFixed(),
    margin:
      price && perShare.gt(0)
        ? new Decimal(1).sub(price.div(perShare)).toFixed()
        : null,
    upside: price ? perShare.div(price).sub(1).toFixed() : null,
    inputs: a,
    equation:
      "EV = Σ FCFₜ/(1+WACC)^t + [FCFₙ×(1+g)/(WACC−g)]/(1+WACC)^n; patrimônio = EV − dívida líquida; por ação = patrimônio/ações",
    source:
      "Premissas manuais. Moeda BRL; fluxos e dívida em reais, ações em unidades; taxas anuais em fração.",
  };
}
export function dcfScenarios(raw: unknown) {
  const a = dcfSchema.parse(raw);
  return [-0.02, 0, 0.02].map((delta, i) => {
    const growth = new Decimal(a.growth).add(delta).toFixed();
    try {
      return {
        name: ["Conservador", "Base", "Otimista"][i],
        growth,
        result: dcf({ ...a, growth }),
        error: null,
      };
    } catch {
      return {
        name: ["Conservador", "Base", "Otimista"][i],
        growth,
        result: null,
        error: "Premissa fora do domínio.",
      };
    }
  });
}
export function sensitivity(raw: unknown) {
  const a = dcfSchema.parse(raw);
  return [-0.01, 0, 0.01].flatMap((dw) =>
    [-0.005, 0, 0.005].map((dg) => {
      const wacc = new Decimal(a.wacc).add(dw).toFixed(),
        terminal = new Decimal(a.terminal).add(dg).toFixed();
      try {
        return {
          wacc,
          terminal,
          value: dcf({ ...a, wacc, terminal }).perShare,
        };
      } catch {
        return { wacc, terminal, value: null };
      }
    }),
  );
}
const v = (
  name: string,
  label: string,
  unit: Formula["variables"][number]["unit"],
  min?: string,
) => ({ name, label, unit, ...(min ? { min } : {}) });
export const presets: Formula[] = [
  {
    name: "Gordon",
    description:
      "Dividendos perpetuamente crescentes. Informe r > g; não aplicável a dividendos instáveis.",
    category: "Valuation",
    expression: "d1 / (r - g)",
    variables: [
      v("d1", "Dividendo esperado por ação", "BRL/acao", "0"),
      v("r", "Retorno exigido (fração)", "taxa", "0"),
      v("g", "Crescimento perpétuo (fração)", "taxa"),
    ],
  },
  {
    name: "P/L relativo",
    description:
      "Múltiplo escolhido manualmente; exige comparáveis consistentes.",
    category: "Valuation",
    expression: "lpa * multiplo",
    variables: [
      v("lpa", "Lucro por ação", "BRL/acao"),
      v("multiplo", "P/L de referência", "numero", "0"),
    ],
  },
  {
    name: "P/VP relativo",
    description: "Múltiplo sobre patrimônio por ação.",
    category: "Valuation",
    expression: "vpa * multiplo",
    variables: [
      v("vpa", "Patrimônio por ação", "BRL/acao"),
      v("multiplo", "P/VP de referência", "numero", "0"),
    ],
  },
  {
    name: "EV/EBITDA relativo",
    description: "EBITDA e dívida em reais, ações em unidades.",
    category: "Valuation",
    expression: "(ebitda * multiplo - divida) / acoes",
    variables: [
      v("ebitda", "EBITDA", "BRL"),
      v("multiplo", "EV/EBITDA", "numero", "0"),
      v("divida", "Dívida líquida", "BRL"),
      v("acoes", "Ações em circulação", "acoes", "0.000001"),
    ],
  },
  {
    name: "Número de Graham",
    description:
      "Método simplificado histórico: sqrt(22,5 × LPA × VPA). Não constitui valor justo universal; exige LPA e VPA positivos.",
    category: "Valuation",
    expression: "sqrt(22.5 * lpa * vpa)",
    variables: [
      v("lpa", "Lucro por ação", "BRL/acao", "0.000001"),
      v("vpa", "Patrimônio por ação", "BRL/acao", "0.000001"),
    ],
  },
  {
    name: "Margem de segurança",
    description: "1 − preço / valor estimado. Resultado em fração.",
    category: "Valuation",
    expression: "1 - preco / valor",
    variables: [
      v("preco", "Preço de referência", "BRL/acao", "0"),
      v("valor", "Valor estimado", "BRL/acao", "0.000001"),
    ],
  },
  {
    name: "Potencial de valorização",
    description: "Valor estimado / preço − 1. Não é previsão.",
    category: "Valuation",
    expression: "valor / preco - 1",
    variables: [
      v("valor", "Valor estimado", "BRL/acao"),
      v("preco", "Preço de referência", "BRL/acao", "0.000001"),
    ],
  },
  {
    name: "Depreciação linear",
    description:
      "Despesa anual de ativo físico; não mede desvalorização de ações nem amortização.",
    category: "Contabilidade",
    expression: "(custo - residual) / vida",
    variables: [
      v("custo", "Custo do ativo", "BRL", "0"),
      v("residual", "Valor residual", "BRL", "0"),
      v("vida", "Vida útil", "anos", "0.000001"),
    ],
  },
  {
    name: "Saldo decrescente",
    description:
      "Despesa do período limitada ao valor residual. Taxa informada em fração.",
    category: "Contabilidade",
    expression: "min(contabil * taxa, contabil - residual)",
    variables: [
      v("contabil", "Saldo contábil inicial", "BRL", "0"),
      v("taxa", "Taxa por período", "taxa", "0"),
      v("residual", "Valor residual", "BRL", "0"),
    ],
  },
  {
    name: "Unidades produzidas",
    description: "Depreciação proporcional ao uso de ativo físico.",
    category: "Contabilidade",
    expression: "(custo - residual) * produzidas / total",
    variables: [
      v("custo", "Custo", "BRL", "0"),
      v("residual", "Valor residual", "BRL", "0"),
      v("produzidas", "Unidades produzidas", "numero", "0"),
      v("total", "Capacidade total", "numero", "0.000001"),
    ],
  },
  {
    name: "Valor presente",
    description: "Taxa por período e quantidade de períodos compatíveis.",
    category: "Matemática financeira",
    expression: "futuro / (1 + taxa)^periodos",
    variables: [
      v("futuro", "Valor futuro", "BRL"),
      v("taxa", "Taxa (fração)", "taxa"),
      v("periodos", "Quantidade de períodos", "numero", "0"),
    ],
  },
  {
    name: "Valor futuro",
    description: "Capitalização composta.",
    category: "Matemática financeira",
    expression: "presente * (1 + taxa)^periodos",
    variables: [
      v("presente", "Valor presente", "BRL"),
      v("taxa", "Taxa (fração)", "taxa"),
      v("periodos", "Quantidade de períodos", "numero", "0"),
    ],
  },
  {
    name: "CAGR",
    description: "Crescimento composto: valores inicial e final positivos.",
    category: "Matemática financeira",
    expression: "(final / inicial)^(1 / periodos) - 1",
    variables: [
      v("final", "Valor final", "BRL", "0.000001"),
      v("inicial", "Valor inicial", "BRL", "0.000001"),
      v("periodos", "Quantidade de períodos", "numero", "0.000001"),
    ],
  },
  {
    name: "WACC",
    description: "Pesos pelo valor de mercado. Taxas e imposto em fração.",
    category: "Matemática financeira",
    expression:
      "capital / (capital + divida) * ke + divida / (capital + divida) * kd * (1 - imposto)",
    variables: [
      v("capital", "Patrimônio a mercado", "BRL", "0"),
      v("divida", "Dívida onerosa", "BRL", "0"),
      v("ke", "Custo do capital próprio", "taxa", "0"),
      v("kd", "Custo da dívida", "taxa", "0"),
      v("imposto", "Alíquota efetiva", "taxa", "0"),
    ],
  },
];
export function validatePreset(f: Formula, values: Record<string, string>) {
  const d = (key: string) => new Decimal(values[key] ?? "0");
  if (f.name === "Gordon" && d("r").lte(d("g")))
    throw Error("Gordon exige retorno maior que crescimento.");
  if (
    ["Depreciação linear", "Unidades produzidas"].includes(f.name) &&
    d("residual").gt(d("custo"))
  )
    throw Error("Residual excede custo.");
  if (
    f.name === "Saldo decrescente" &&
    (d("residual").gt(d("contabil")) || d("taxa").gt(1))
  )
    throw Error("Saldo/taxa inválidos.");
  if (f.name === "Unidades produzidas" && d("produzidas").gt(d("total")))
    throw Error("Produção excede capacidade.");
  if (f.name === "WACC" && d("imposto").gt(1))
    throw Error("Imposto deve estar entre 0 e 1.");
}
