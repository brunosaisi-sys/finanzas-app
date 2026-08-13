"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { convertViaMep } from "@/lib/finance/mep";
import type { Currency } from "@/types";

interface Props {
  totalValueARS: number;
  totalCostARS: number;
  totalValueUSD: number;
  totalCostUSD: number;
}

// TAREA 4c (Sesión J.1.15): toggle ARS/USD que consolida el portafolio en UN solo
// número convirtiendo la porción en la otra moneda al MEP — distinto del desglose
// por moneda de abajo (que nunca suma ARS+USD entre sí, principio ya establecido
// en TAREA 3/8 de Sesión J.1.14). Tasa MEP manual, mismo patrón que TAREA 1 y
// DistribuirForm — sin feed en vivo, el usuario la ingresa.
export default function PortfolioValueToggle({
  totalValueARS,
  totalCostARS,
  totalValueUSD,
  totalCostUSD,
}: Props) {
  const bothCurrencies = totalValueARS > 0 && totalValueUSD > 0;
  const [display, setDisplay] = useState<Currency>("ARS");
  const [mepRate, setMepRate] = useState("");
  const mepRateNum = parseFloat(mepRate) || 0;

  const needsRate = bothCurrencies;
  const canConvert = !needsRate || mepRateNum > 0;

  const consolidatedValue = display === "ARS"
    ? totalValueARS + (canConvert ? convertViaMep(totalValueUSD, "USD", "ARS", mepRateNum || 1) : 0)
    : totalValueUSD + (canConvert ? convertViaMep(totalValueARS, "ARS", "USD", mepRateNum || 1) : 0);
  const consolidatedCost = display === "ARS"
    ? totalCostARS + (canConvert ? convertViaMep(totalCostUSD, "USD", "ARS", mepRateNum || 1) : 0)
    : totalCostUSD + (canConvert ? convertViaMep(totalCostARS, "ARS", "USD", mepRateNum || 1) : 0);
  const consolidatedPnl = consolidatedValue - consolidatedCost;
  const consolidatedPnlPct = consolidatedCost > 0 ? (consolidatedPnl / consolidatedCost) * 100 : null;

  const showValue = !needsRate || mepRateNum > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide">
          Valor total del portafolio
        </p>
        {bothCurrencies && (
          <div className="flex bg-fz-surface rounded-lg p-0.5 gap-0.5 text-[11px]">
            {(["ARS", "USD"] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setDisplay(cur)}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                  display === cur ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        )}
      </div>

      {needsRate && (
        <div className="flex items-center gap-2 bg-fz-surface rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] text-fz-text-secondary font-medium shrink-0">
            Tipo MEP para consolidar:
          </span>
          <input
            type="number"
            step="1"
            min="0"
            placeholder="ej. 1200"
            value={mepRate}
            onChange={(e) => setMepRate(e.target.value)}
            className="w-24 border border-fz-border rounded px-2 py-0.5 text-xs text-fz-text bg-fz-bg focus:outline-none focus:ring-1 focus:ring-fz-accent text-right"
          />
        </div>
      )}

      {showValue ? (
        <div>
          <p className="font-display font-extrabold text-4xl text-fz-text tabular-nums">
            {formatCurrency(consolidatedValue, display)}
          </p>
          {consolidatedPnlPct != null && (
            <p
              className={`text-sm font-semibold tabular-nums font-mono ${
                consolidatedPnl >= 0 ? "text-fz-accent" : "text-fz-negative"
              }`}
            >
              {consolidatedPnl >= 0 ? "+" : ""}
              {consolidatedPnlPct.toFixed(1)}% ({consolidatedPnl >= 0 ? "+" : ""}
              {formatCurrency(consolidatedPnl, display)})
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-fz-text-tertiary">Ingresá el tipo MEP para ver el total consolidado.</p>
      )}
    </div>
  );
}
