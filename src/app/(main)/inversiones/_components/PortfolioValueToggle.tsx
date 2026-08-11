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
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Valor total del portafolio
        </p>
        {bothCurrencies && (
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[11px]">
            {(["ARS", "USD"] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setDisplay(cur)}
                className={`px-2 py-1 font-medium transition-colors ${
                  display === cur ? "bg-gray-900 text-white" : "bg-white text-gray-500"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        )}
      </div>

      {needsRate && (
        <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] text-amber-700 font-medium shrink-0">
            Tipo MEP para consolidar:
          </span>
          <input
            type="number"
            step="1"
            min="0"
            placeholder="ej. 1200"
            value={mepRate}
            onChange={(e) => setMepRate(e.target.value)}
            className="w-24 border border-amber-200 rounded px-2 py-0.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 text-right"
          />
        </div>
      )}

      {showValue ? (
        <div>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {formatCurrency(consolidatedValue, display)}
          </p>
          {consolidatedPnlPct != null && (
            <p
              className={`text-sm font-semibold tabular-nums ${
                consolidatedPnl >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {consolidatedPnl >= 0 ? "+" : ""}
              {consolidatedPnlPct.toFixed(1)}% ({consolidatedPnl >= 0 ? "+" : ""}
              {formatCurrency(consolidatedPnl, display)})
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Ingresá el tipo MEP para ver el total consolidado.</p>
      )}
    </div>
  );
}
