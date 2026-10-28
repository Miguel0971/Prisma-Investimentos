import Decimal from "decimal.js";
import { decimalSchema } from "./formula";
export function statementReais(row: {
  value: string;
  currency: string;
  scale: string;
}) {
  if (row.currency !== "REAL")
    throw Error("Somente valores em REAL podem preencher uma variável BRL.");
  const scale: Record<string, string> = { MIL: "1000", UNIDADE: "1" };
  if (!Object.hasOwn(scale, row.scale))
    throw Error("Escala contábil não reconhecida; revisão manual necessária.");
  return new Decimal(decimalSchema.parse(row.value))
    .mul(scale[row.scale])
    .toFixed();
}
