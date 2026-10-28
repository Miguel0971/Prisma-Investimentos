import { it, expect } from "vitest";
import { evaluate, runFormula } from "../src/services/formula";
import {
  dcf,
  dcfScenarios,
  sensitivity,
  presets,
  validatePreset,
} from "../src/services/valuation";
it("aritmética decimal exata e precedência", () => {
  expect(evaluate("0.1 + 0.2", {}).value).toBe("0.3");
  expect(evaluate("2 + 3 * 4", {}).value).toBe("14");
  expect(evaluate("-2^2", {}).value).toBe("-4");
});
it.each([
  "process.exit()",
  "constructor.constructor(1)",
  "fetch(1)",
  "1;alert(1)",
  "x[0]",
  "2 ** 3",
  "1/0",
  "sqrt(-1)",
  "9^999",
  "(".repeat(40) + "1" + ")".repeat(40),
])("bloqueia %s", (expr) => expect(() => evaluate(expr, {})).toThrow());
it("nega unidades incompatíveis, nulos e variáveis ausentes", () => {
  expect(() =>
    evaluate("dinheiro + acoes", {
      dinheiro: { value: "10", unit: "BRL" },
      acoes: { value: "2", unit: "acoes" },
    }),
  ).toThrow("Unidades");
  expect(() => evaluate("x", {})).toThrow();
  expect(() => runFormula(presets[0], { d1: null })).toThrow();
});
it("DCF conhecido: perpetuidade sem crescimento vale 1000, ação vale 10", () => {
  const r = dcf({
    fcf: "100",
    growth: "0",
    years: 5,
    wacc: "0.1",
    terminal: "0",
    netDebt: "0",
    shares: "100",
    price: "8",
  });
  expect(Number(r.enterprise)).toBeCloseTo(1000, 10);
  expect(Number(r.perShare)).toBeCloseTo(10, 10);
  expect(Number(r.margin)).toBeCloseTo(0.2);
  expect(Number(r.upside)).toBeCloseTo(0.25);
});
it("DCF rejeita wacc <= terminal e ações zero; recalcula cenários", () => {
  const a = {
    fcf: "100",
    growth: "0.04",
    years: 5,
    wacc: "0.1",
    terminal: "0.02",
    netDebt: "50",
    shares: "100",
  };
  expect(() => dcf({ ...a, terminal: "0.1" })).toThrow();
  expect(() => dcf({ ...a, shares: "0" })).toThrow();
  const scenarios = dcfScenarios(a);
  expect(Number(scenarios[0].result?.perShare)).toBeLessThan(
    Number(scenarios[2].result?.perShare),
  );
  expect(sensitivity(a)).toHaveLength(9);
});
it("Gordon e depreciação conhecidos", () => {
  const g = presets.find((x) => x.name === "Gordon")!;
  expect(runFormula(g, { d1: "2", r: "0.1", g: "0.02" }).value).toBe("25");
  expect(() => validatePreset(g, { r: "0.02", g: "0.03" })).toThrow();
  const linear = presets.find((x) => x.name === "Depreciação linear")!;
  expect(
    runFormula(linear, { custo: "1000", residual: "100", vida: "3" }).value,
  ).toBe("300");
});

it("bloqueia expansão decimal por underflow", () => {
  expect(() => evaluate("(0.00001 ^ 100) ^ 100", {})).toThrow("limite");
});
