import Decimal from "decimal.js";
import { z } from "zod";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const decimalSchema = z
  .string()
  .max(60)
  .regex(
    /^-?\d+(\.\d+)?$/,
    "Informe decimal com ponto, sem separador de milhar.",
  )
  .refine(
    (x) => new Decimal(x).isFinite() && new Decimal(x).abs().lte("1e30"),
    "Valor fora do limite",
  );
export const units = [
  "numero",
  "BRL",
  "acoes",
  "BRL/acao",
  "taxa",
  "anos",
] as const;
export const variableSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/),
    label: z.string().min(1).max(100),
    unit: z.enum(units),
    min: decimalSchema.optional(),
    max: decimalSchema.optional(),
    default: decimalSchema.optional(),
  })
  .strict()
  .refine(
    (v) => !v.min || !v.max || new Decimal(v.min).lte(v.max),
    "Mínimo excede máximo.",
  );
export const formulaSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000),
    category: z.enum(["Valuation", "Contabilidade", "Matemática financeira"]),
    expression: z.string().min(1).max(1000),
    variables: z.array(variableSchema).min(1).max(30),
  })
  .strict();
export type Formula = z.infer<typeof formulaSchema>;
type Dim = [number, number, number];
type Quantity = { value: Decimal; dim: Dim };
const dimensions: Record<(typeof units)[number], Dim> = {
  numero: [0, 0, 0],
  taxa: [0, 0, 0],
  BRL: [1, 0, 0],
  acoes: [0, 1, 0],
  "BRL/acao": [1, -1, 0],
  anos: [0, 0, 1],
};
function same(a: Dim, b: Dim) {
  return a.every((v, i) => v === b[i]);
}
function checked(q: Quantity) {
  if (
    !q.value.isFinite() ||
    q.value.abs().gt("1e100") ||
    (!q.value.isZero() && q.value.abs().lt("1e-100"))
  )
    throw Error("Resultado excede limite numérico.");
  if (q.dim.some((x) => !Number.isInteger(x) || Math.abs(x) > 8))
    throw Error("Unidade incompatível ou excessivamente complexa.");
  return q;
}
export function evaluate(
  expression: string,
  variables: Record<string, { value: string; unit: (typeof units)[number] }>,
) {
  if (expression.length > 1000) throw Error("Expressão longa demais.");
  const tokens =
    expression.match(/(?:\d+(?:\.\d+)?|[a-z][a-z0-9_]*|[+*/^(),-])/g) ?? [];
  if (tokens.join("") !== expression.replace(/\s/g, "") || tokens.length > 200)
    throw Error("Expressão contém elementos não permitidos.");
  let pos = 0,
    depth = 0;
  function node(): Quantity {
    if (++depth > 30) throw Error("Expressão complexa demais.");
    let result: Quantity;
    const t = tokens[pos++];
    if (t === "(") {
      result = sum();
      if (tokens[pos++] !== ")") throw Error("Parêntese ausente.");
    } else if (t && /^\d/.test(t)) {
      result = { value: new Decimal(t), dim: [0, 0, 0] };
    } else if (t && /^[a-z]/.test(t)) {
      if (tokens[pos] === "(") {
        pos++;
        const args = [sum()];
        while (tokens[pos] === ",") {
          pos++;
          args.push(sum());
          if (args.length > 10) throw Error("Argumentos demais.");
        }
        if (tokens[pos++] !== ")") throw Error("Parêntese ausente.");
        if (t === "sqrt" && args.length === 1) {
          if (args[0].value.lt(0)) throw Error("Raiz de valor negativo.");
          result = {
            value: args[0].value.sqrt(),
            dim: args[0].dim.map((v) => v / 2) as Dim,
          };
        } else if (t === "abs" && args.length === 1)
          result = { ...args[0], value: args[0].value.abs() };
        else if ((t === "min" || t === "max") && args.length >= 2) {
          if (args.some((a) => !same(a.dim, args[0].dim)))
            throw Error("Unidades incompatíveis.");
          result = {
            dim: args[0].dim,
            value:
              t === "min"
                ? Decimal.min(...args.map((a) => a.value))
                : Decimal.max(...args.map((a) => a.value)),
          };
        } else throw Error("Função não permitida ou argumentos inválidos.");
      } else {
        if (!Object.hasOwn(variables, t)) throw Error(`Variável ausente: ${t}`);
        const v = variables[t];
        result = {
          value: new Decimal(decimalSchema.parse(v.value)),
          dim: dimensions[v.unit],
        };
      }
    } else throw Error("Expressão inválida.");
    depth--;
    return checked(result);
  }
  function power(): Quantity {
    let a = node();
    if (tokens[pos] === "^") {
      pos++;
      const b = unary();
      if (!same(b.dim, [0, 0, 0]) || b.value.abs().gt(100))
        throw Error("Expoente inválido.");
      if (a.value.eq(0) && b.value.lte(0)) throw Error("Potência indefinida.");
      a = checked({
        value: a.value.pow(b.value),
        dim: a.dim.map((d) => d * b.value.toNumber()) as Dim,
      });
    }
    return a;
  }
  function unary(): Quantity {
    if (tokens[pos] === "-") {
      pos++;
      const a = unary();
      return { ...a, value: a.value.negated() };
    }
    if (tokens[pos] === "+") {
      pos++;
      return unary();
    }
    return power();
  }
  function product(): Quantity {
    let a = unary();
    while (tokens[pos] === "*" || tokens[pos] === "/") {
      const op = tokens[pos++];
      const b = unary();
      if (op === "/" && b.value.eq(0)) throw Error("Divisão por zero.");
      a = checked({
        value: op === "*" ? a.value.mul(b.value) : a.value.div(b.value),
        dim: a.dim.map((d, i) =>
          op === "*" ? d + b.dim[i] : d - b.dim[i],
        ) as Dim,
      });
    }
    return a;
  }
  function sum(): Quantity {
    let a = product();
    while (tokens[pos] === "+" || tokens[pos] === "-") {
      const op = tokens[pos++];
      const b = product();
      if (!same(a.dim, b.dim))
        throw Error("Unidades incompatíveis na soma/subtração.");
      a = checked({
        dim: a.dim,
        value: op === "+" ? a.value.add(b.value) : a.value.sub(b.value),
      });
    }
    return a;
  }
  const result = sum();
  if (pos !== tokens.length)
    throw Error("Expressão incompleta ou operador não permitido.");
  return {
    value: result.value.toFixed(),
    unit: `BRL^${result.dim[0]} · ações^${result.dim[1]} · anos^${result.dim[2]}`,
  };
}
export function runFormula(input: unknown, values: unknown) {
  const f = formulaSchema.parse(input);
  if (new Set(f.variables.map((v) => v.name)).size !== f.variables.length)
    throw Error("Variáveis duplicadas.");
  const raw = z.record(z.string(), decimalSchema).parse(values);
  const vars: Record<string, { value: string; unit: (typeof units)[number] }> =
    {};
  for (const v of f.variables) {
    const value = raw[v.name] ?? v.default;
    if (value === undefined) throw Error(`Preencha ${v.label}`);
    if (
      (v.min && new Decimal(value).lt(v.min)) ||
      (v.max && new Decimal(value).gt(v.max))
    )
      throw Error(`Valor fora do intervalo: ${v.label}`);
    vars[v.name] = { value, unit: v.unit };
  }
  const result = evaluate(f.expression, vars);
  return {
    ...result,
    expression: f.expression,
    inputs: vars,
    source: "Premissas manuais do usuário; cálculo determinístico decimal.",
  };
}
