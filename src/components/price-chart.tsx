"use client";
import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
  ColorType,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/services/market";
import { sma, rsi, macd } from "@/services/indicators";
export function PriceChart({ history }: { history: Candle[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState("linha");
  const [average, setAverage] = useState(true);
  useEffect(() => {
    if (!ref.current || !history.length) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "#131c28" },
        textColor: "#cdd7e6",
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#202d3d" },
        horzLines: { color: "#202d3d" },
      },
      timeScale: { timeVisible: true },
      localization: { locale: "pt-BR" },
    });
    if (kind === "candles") {
      chart
        .addSeries(CandlestickSeries)
        .setData(history.map((x) => ({ ...x, time: x.time as UTCTimestamp })));
    } else {
      chart
        .addSeries(LineSeries, { color: "#78e3c1", lineWidth: 2 })
        .setData(
          history.map((x) => ({
            time: x.time as UTCTimestamp,
            value: x.close,
          })),
        );
    }
    if (average) {
      const values = sma(
        history.map((x) => x.close),
        20,
      );
      chart
        .addSeries(LineSeries, { color: "#f5bb63", lineWidth: 1 })
        .setData(
          history.flatMap((x, i) =>
            values[i] == null
              ? []
              : [{ time: x.time as UTCTimestamp, value: values[i]! }],
          ),
        );
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [history, kind, average]);
  const values = history.map((x) => x.close);
  const strength = rsi(values).at(-1);
  const convergence = macd(values).line.at(-1);
  if (!history.length)
    return (
      <p role="status">Histórico não retornado para este período/plano.</p>
    );
  return (
    <>
      <div className="toolbar">
        <label>
          Gráfico{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="linha">Linha</option>
            <option value="candles">Candles</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={average}
            onChange={(e) => setAverage(e.target.checked)}
          />{" "}
          Média móvel 20 períodos
        </label>
      </div>
      <div
        ref={ref}
        role="img"
        aria-label="Gráfico de preços históricos. Valores tabulados abaixo."
      />
      <p>
        RSI 14: {strength?.toFixed(2) ?? "Histórico insuficiente"} · MACD 12/26:{" "}
        {convergence?.toFixed(2) ?? "Histórico insuficiente"}
      </p>
      <small>
        Indicadores sobre fechamentos do fornecedor, potencialmente ajustados.
        Histórico pode ser limitado pelo plano.{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          Gráfico por TradingView Lightweight Charts™
        </a>
        .
      </small>
      <details>
        <summary>Consultar dados do gráfico</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data (São Paulo)</th>
                <th>Abertura</th>
                <th>Máxima</th>
                <th>Mínima</th>
                <th>Fechamento</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(-300).map((x) => (
                <tr key={x.time}>
                  <td>
                    {new Date(x.time * 1000).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>{x.open}</td>
                  <td>{x.high}</td>
                  <td>{x.low}</td>
                  <td>{x.close}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small>Últimos 300 pontos na tabela.</small>
      </details>
    </>
  );
}
