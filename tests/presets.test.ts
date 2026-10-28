import { it, expect } from "vitest";
import { presets, validatePreset } from "../src/services/valuation";
import { runFormula } from "../src/services/formula";
import { money } from "../src/lib/format";
const cases: [string, Record<string, string>, number][] = [
  ["Gordon", { d1: "2", r: "0.1", g: "0.02" }, 25],
  ["P/L relativo", { lpa: "2", multiplo: "10" }, 20],
  ["P/VP relativo", { vpa: "10", multiplo: "1.5" }, 15],
  [
    "EV/EBITDA relativo",
    { ebitda: "1000", multiplo: "5", divida: "1000", acoes: "100" },
    40,
  ],
  ["Número de Graham", { lpa: "2", vpa: "20" }, 30],
  ["Margem de segurança", { preco: "80", valor: "100" }, 0.2],
  ["Potencial de valorização", { preco: "80", valor: "100" }, 0.25],
  ["Depreciação linear", { custo: "1000", residual: "100", vida: "3" }, 300],
  [
    "Saldo decrescente",
    { contabil: "1000", taxa: "0.2", residual: "100" },
    200,
  ],
  [
    "Unidades produzidas",
    { custo: "1000", residual: "100", produzidas: "100", total: "1000" },
    90,
  ],
  ["Valor presente", { futuro: "121", taxa: "0.1", periodos: "2" }, 100],
  ["Valor futuro", { presente: "100", taxa: "0.1", periodos: "2" }, 121],
  ["CAGR", { final: "121", inicial: "100", periodos: "2" }, 0.1],
  [
    "WACC",
    { capital: "600", divida: "400", ke: "0.1", kd: "0.05", imposto: "0.2" },
    0.076,
  ],
];
it.each(cases)(
  "%s confere com cálculo independente",
  (name, values, expected) => {
    const formula = presets.find((f) => f.name === name)!;
    validatePreset(formula, values);
    expect(Number(runFormula(formula, values).value)).toBeCloseTo(expected, 12);
  },
);
it("formatação BRL não perde centavos acima do inteiro seguro de JavaScript", () => {
  expect(money("9007199254740993.12")).toContain("9.007.199.254.740.993,12");
});
