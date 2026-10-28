import { it, expect } from "vitest";
import { statementReais } from "../src/services/financial-bindings";
it("converte escala CVM para reais com precisão e preserva negativos", () => {
  expect(
    statementReais({
      value: "-1234.5678900000",
      currency: "REAL",
      scale: "MIL",
    }),
  ).toBe("-1234567.89");
  expect(
    statementReais({ value: "0.10", currency: "REAL", scale: "UNIDADE" }),
  ).toBe("0.1");
});
it("rejeita moeda ou escala incompatíveis", () => {
  expect(() =>
    statementReais({ value: "10", currency: "USD", scale: "MIL" }),
  ).toThrow();
  expect(() =>
    statementReais({ value: "10", currency: "REAL", scale: "MILHOES" }),
  ).toThrow();
});
