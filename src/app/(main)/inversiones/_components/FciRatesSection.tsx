import { formatCurrency } from "@/lib/format";
import { fetchAllFCIRates, matchFCIRate } from "@/lib/fciRates";
import HoldingPriceEdit from "./HoldingPriceEdit";
import type { Holding, Currency } from "@/types";

type HoldingRow = Holding & { accounts: { name: string } | null };

// Renders VCP badge + fallback price edit for a single holding.
// Called after FCI rates are fetched; wrapped in Suspense by parent.
export async function FciRateCell({ holding }: { holding: HoldingRow }) {
  const fciRates = await fetchAllFCIRates();
  const fciRate = matchFCIRate(holding, fciRates);

  if (fciRate) {
    return (
      <p className="text-xs font-medium text-indigo-700 mt-0.5">
        VCP {formatCurrency(fciRate.vcp, holding.currency as Currency)}
        <span className="text-gray-400 font-normal ml-1">
          ·{" "}
          {new Date(fciRate.fecha).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </p>
    );
  }

  return (
    <HoldingPriceEdit
      holdingId={holding.id}
      currentPrice={holding.current_price}
      currency={holding.currency}
    />
  );
}

// Resumen del portafolio — usa current_price ya guardado en DB (actualizado por auto-sync).
export async function FciPortfolioSummary({
  holdings,
}: {
  holdings: HoldingRow[];
}) {
  const withPrice = holdings.filter((h) => h.current_price != null);
  const totalValueARS = withPrice
    .filter((h) => h.currency === "ARS")
    .reduce((s, h) => s + h.quantity * h.current_price!, 0);
  const totalCostARS = withPrice
    .filter((h) => h.currency === "ARS")
    .reduce((s, h) => s + h.quantity * h.avg_buy_price, 0);
  const totalValueUSD = withPrice
    .filter((h) => h.currency === "USD")
    .reduce((s, h) => s + h.quantity * h.current_price!, 0);
  const totalCostUSD = withPrice
    .filter((h) => h.currency === "USD")
    .reduce((s, h) => s + h.quantity * h.avg_buy_price, 0);
  const pnlARS = totalValueARS - totalCostARS;
  const pnlUSD = totalValueUSD - totalCostUSD;

  if (totalValueARS === 0 && totalValueUSD === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Portafolio (con precio actual)
      </p>
      {totalValueARS > 0 && (
        <div>
          <p className="text-2xl font-semibold text-gray-900 tabular-nums">
            {formatCurrency(totalValueARS, "ARS")}
          </p>
          <p
            className={`text-sm font-medium tabular-nums ${
              pnlARS >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {pnlARS >= 0 ? "+" : ""}
            {formatCurrency(pnlARS, "ARS")} en pesos
          </p>
        </div>
      )}
      {totalValueUSD > 0 && (
        <div>
          <p className="text-xl font-semibold text-gray-900 tabular-nums">
            {formatCurrency(totalValueUSD, "USD")}
          </p>
          <p
            className={`text-sm font-medium tabular-nums ${
              pnlUSD >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {pnlUSD >= 0 ? "+" : ""}
            {formatCurrency(pnlUSD, "USD")} en dólares
          </p>
        </div>
      )}
    </section>
  );
}
