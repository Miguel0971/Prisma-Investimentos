// Intl.NumberFormat preserva a precisão de strings decimais; não converter para Number.
export const money = (
  value: number | string | null | undefined,
  currency = "BRL",
) =>
  value == null
    ? "Não disponível"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
        value as number,
      );
export const number = (value: number | null | undefined) =>
  value == null
    ? "Não disponível"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
        value,
      );
export const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
