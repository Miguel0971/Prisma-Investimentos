export function sma(values: number[], period: number): (number | null)[] {
  if (!Number.isInteger(period) || period < 1)
    throw new Error("Período inválido");
  return values.map((_, i) =>
    i + 1 < period
      ? null
      : values.slice(i + 1 - period, i + 1).reduce((a, b) => a + b, 0) / period,
  );
}
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length < period) return out;
  let previous = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = previous;
  for (let i = period; i < values.length; i++) {
    previous =
      values[i] * (2 / (period + 1)) + previous * (1 - 2 / (period + 1));
    out[i] = previous;
  }
  return out;
}
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  if (values.length <= period) return out;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    gain += Math.max(0, d) / period;
    loss += Math.max(0, -d) / period;
  }
  const score = () =>
    gain === 0 && loss === 0
      ? 50
      : loss === 0
        ? 100
        : 100 - 100 / (1 + gain / loss);
  out[period] = score();
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(0, d)) / period;
    loss = (loss * (period - 1) + Math.max(0, -d)) / period;
    out[i] = score();
  }
  return out;
}
export function macd(values: number[]) {
  const fast = ema(values, 12),
    slow = ema(values, 26);
  const line = values.map((_, i) =>
    fast[i] == null || slow[i] == null ? null : fast[i]! - slow[i]!,
  );
  const valid = line.filter((x): x is number => x !== null);
  const tail = ema(valid, 9);
  const signal = line.map((_, i) => (i < 25 ? null : (tail[i - 25] ?? null)));
  return {
    line,
    signal,
    histogram: line.map((v, i) =>
      v == null || signal[i] == null ? null : v - signal[i]!,
    ),
  };
}
