import { formatCurrency } from "@/lib/format";
import { fetchAllFCIRates, matchFCIRate } from "@/lib/fciRates";
import { Money } from "@/components/Money";
import HoldingPriceEdit from "./HoldingPriceEdit";
import PortfolioValueToggle from "./PortfolioValueToggle";
import type { Holding, Currency } from "@/types";

type HoldingRow = Holding & { accounts: { name: string } | null };

// Renders VCP badge + fallback price edit for a single holding.
// Called after FCI rates are fetched; wrapped in Suspense by parent.
export async function FciRateCell({ holding }: { holding: HoldingRow }) {
  const fciRates = await fetchAllFCIRates();
  const fciRate = matchFCIRate(holding, fciRates);

  if (fciRate) {
    return (
      <p className="text-xs font-medium text-fz-accent mt-0.5 font-mono">
        VCP <Money>{formatCurrency(fciRate.vcp, holding.currency as Currency)}</Money>
        <span className="text-fz-text-tertiary font-normal ml-1 font-sans">
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
    <section className="bg-fz-surface-high rounded-[22px] p-5 space-y-3">
      <PortfolioValueToggle
        totalValueARS={totalValueARS}
        totalCostARS={totalCostARS}
        totalValueUSD={totalValueUSD}
        totalCostUSD={totalCostUSD}
      />

      {/* TAREA 4d: desglose por moneda como información secundaria/colapsada —
          nunca se suman entre sí (principio ya establecido, TAREA 3/8 Sesión
          J.1.14), el toggle de arriba ya resuelve "quiero un solo número". */}
      {totalValueARS > 0 && totalValueUSD > 0 && (
        <details className="pt-2 border-t border-fz-border">
          <summary className="text-[11px] text-fz-text-tertiary cursor-pointer select-none">
            Ver desglose por moneda
          </summary>
          <div className="mt-2 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-fz-text-secondary">ARS</span>
              <div className="text-right">
                <p className="text-sm font-medium text-fz-text tabular-nums font-mono">
                  <Money>{formatCurrency(totalValueARS, "ARS")}</Money>
                </p>
                <p
                  className={`text-[11px] tabular-nums font-mono ${
                    pnlARS >= 0 ? "text-fz-accent" : "text-fz-negative"
                  }`}
                >
                  {pnlARS >= 0 ? "+" : ""}
                  {formatCurrency(pnlARS, "ARS")}
                </p>
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-fz-text-secondary">USD</span>
              <div className="text-right">
                <p className="text-sm font-medium text-fz-text tabular-nums font-mono">
                  <Money>{formatCurrency(totalValueUSD, "USD")}</Money>
                </p>
                <p
                  className={`text-[11px] tabular-nums font-mono ${
                    pnlUSD >= 0 ? "text-fz-accent" : "text-fz-negative"
                  }`}
                >
                  {pnlUSD >= 0 ? "+" : ""}
                  {formatCurrency(pnlUSD, "USD")}
                </p>
              </div>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}
