import { formatCurrency } from "@/lib/format";
import HoldingPriceEdit from "./HoldingPriceEdit";
import type { Holding } from "@/types";

type HoldingRow = Holding & { accounts: { name: string } | null };
type FciFondo = { fondo: string; tna: number; fecha: string };

async function fetchAllFCIRates(): Promise<Map<string, { tna: number; fecha: string }>> {
  const cats = ["mercadoDinero", "rentaFija", "rentaVariable", "rentaMixta"];
  const map = new Map<string, { tna: number; fecha: string }>();

  await Promise.allSettled(
    cats.map(async (cat) => {
      try {
        const res = await fetch(
          `https://api.argentinadatos.com/v1/finanzas/fci/${cat}/ultimo`,
          { next: { revalidate: 21600 } }
        );
        if (!res.ok) return;
        const data: FciFondo[] = await res.json();
        for (const f of data) {
          map.set(f.fondo.toLowerCase(), { tna: f.tna, fecha: f.fecha });
        }
      } catch {
        // silent fail per category
      }
    })
  );

  return map;
}

function matchFCIRate(
  holding: HoldingRow,
  rates: Map<string, { tna: number; fecha: string }>
): { tna: number; fecha: string } | null {
  if (holding.asset_type !== "fci") return null;
  const needle = (holding.ticker ?? holding.name).toLowerCase();
  if (rates.has(needle)) return rates.get(needle)!;
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  for (const [key, val] of rates) {
    if (words.length > 0 && words.some((w) => key.includes(w))) return val;
  }
  return null;
}

// Renders TNA badge + fallback price edit for a single holding.
// Called after FCI rates are fetched; wrapped in Suspense by parent.
export async function FciRateCell({ holding }: { holding: HoldingRow }) {
  const fciRates = await fetchAllFCIRates();
  const fciRate = matchFCIRate(holding, fciRates);

  if (fciRate) {
    return (
      <p className="text-xs font-medium text-indigo-700 mt-0.5">
        {fciRate.tna.toFixed(1)}% TNA
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

// Resumen del portafolio con TNA — also async so it doesn't block holdings list.
export async function FciPortfolioSummary({
  holdings,
}: {
  holdings: HoldingRow[];
}) {
  // Portfolio summary only uses current_price already stored in DB — no external fetch.
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
