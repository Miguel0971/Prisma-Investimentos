import { describe, it, expect } from "vitest";
import { isOwner, tickerSchema, authConfigured } from "../src/lib/policy";
describe("autorização fail-closed", () => {
  it("nega ausência de configuração", () => {
    expect(isOwner("123", undefined)).toBe(false);
    expect(authConfigured({})).toBe(false);
  });
  it("nega outro usuário e tipos inesperados", () => {
    for (const id of ["124", 123, null, undefined, "123 "])
      expect(isOwner(id, "123")).toBe(false);
  });
  it("permite somente ID numérico exato", () => {
    expect(isOwner("123", "123")).toBe(true);
    expect(isOwner("nome", "nome")).toBe(false);
  });
  it("exige segredo forte e banco", () => {
    const env = {
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "a".repeat(32),
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
      OWNER_GITHUB_ID: "123",
      DATABASE_URL: "postgresql://example",
    };
    expect(authConfigured(env)).toBe(true);
    expect(authConfigured({ ...env, NEXTAUTH_SECRET: "curto" })).toBe(false);
    expect(authConfigured({ ...env, DATABASE_URL: "" })).toBe(false);
  });
});
describe("entrada de ticker", () => {
  it("normaliza entrada", () =>
    expect(tickerSchema.parse(" petr4 ")).toBe("PETR4"));
  it("aceita ações e units", () => {
    for (const x of ["PETR4", "VALE3", "TAEE11"])
      expect(tickerSchema.safeParse(x).success).toBe(true);
  });
  it("bloqueia payloads e entradas inválidas", () => {
    for (const x of [
      null,
      "",
      "<script>",
      "PETR4;DROP TABLE users",
      "A".repeat(10000),
      "12345",
    ])
      expect(tickerSchema.safeParse(x).success).toBe(false);
  });
});
