import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import HoldingPriceEdit from "./_components/HoldingPriceEdit";
import type { Holding } from "@/types";

const ASSET_LABELS: Record<string, string> = {
  accion: "Acción",
  cedear: "CEDEAR",
  bono: "Bono",
  fci: "FCI",
  crypto: "Crypto",
  otro: "Otro",
};

type HoldingRow = Holding & { accounts: { name: string } | null };

type FciFondo = { fondo: string; tna: number; fecha: string };

// ArgentinaDatos solo provee TNA de FCI (no cotizaciones de acciones/CEDEARs).
// Para acciones y CEDEARs se usa precio manual via HoldingPriceEdit.
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
        // silent fail per category — API is best-effort
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

  // Match by significant words (length > 3) from holding name against fund name
  const words = needle.split(/\s+/).filter((w) => w.length > 3);
  for (const [key, val] of rates) {
    if (words.length > 0 && words.some((w) => key.includes(w))) return val;
  }
  return null;
}

export default async function InversionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, fciRates] = await Promise.all([
    supabase
      .from("holdings")
      .select("*, accounts(name)")
      .order("created_at", { ascending: false }),
    fetchAllFCIRates(),
  ]);

  const holdings = (data ?? []) as HoldingRow[];

  if (holdings.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between pt-2 mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Inversiones</h1>
          <Link
            href="/inversiones/nueva"
            className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
          >
            + Agregar
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
          <p className="text-4xl">📈</p>
          <p className="text-sm font-medium text-gray-900">Sin posiciones cargadas</p>
          <p className="text-sm text-gray-400">
            Cargá tus acciones, CEDEARs, bonos o FCI para ver tu portafolio y rendimiento.
          </p>
          <Link
            href="/inversiones/nueva"
            className="inline-block mt-2 text-sm font-medium text-gray-900 underline"
          >
            Cargar primera posición
          </Link>
        </div>
      </div>
    );
  }

  // Resumen del portafolio (solo holdings con precio actual cargado)
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

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-semibold text-gray-900">Inversiones</h1>
        <Link
          href="/inversiones/nueva"
          className="text-sm font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
        >
          + Agregar
        </Link>
      </div>

      {/* Aviso sobre cotizaciones */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">FCI:</span> TNA actualizada desde ArgentinaDatos (cada 6 h).
          <span className="ml-2 font-medium text-gray-700">Acciones / CEDEARs:</span> sin feed automático — actualizá el precio manualmente.
        </p>
      </section>

      {/* Resumen portafolio */}
      {(totalValueARS > 0 || totalValueUSD > 0) && (
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
      )}

      {/* Lista de posiciones */}
      <section>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {holdings.map((holding) => {
            const cost = holding.quantity * holding.avg_buy_price;
            const currentValue =
              holding.current_price != null
                ? holding.quantity * holding.current_price
                : null;
            const pnl = currentValue != null ? currentValue - cost : null;
            const pnlPct =
              pnl != null && cost > 0 ? (pnl / cost) * 100 : null;

            const fciRate = matchFCIRate(holding, fciRates);

            return (
              <div key={holding.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {holding.ticker && (
                        <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {holding.ticker}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {holding.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ASSET_LABELS[holding.asset_type]} · {holding.quantity} u. · PA{" "}
                      {formatCurrency(holding.avg_buy_price, holding.currency)}
                    </p>
                    {holding.accounts && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {holding.accounts.name}
                      </p>
                    )}

                    {/* FCI: mostrar TNA si hay match */}
                    {fciRate && (
                      <p className="text-xs font-medium text-indigo-700 mt-0.5">
                        {fciRate.tna.toFixed(1)}% TNA
                        <span className="text-gray-400 font-normal ml-1">
                          · {new Date(fciRate.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                        </span>
                      </p>
                    )}

                    {/* Acciones/CEDEARs/bonos: edición manual de precio */}
                    {holding.asset_type !== "fci" && (
                      <HoldingPriceEdit
                        holdingId={holding.id}
                        currentPrice={holding.current_price}
                        currency={holding.currency}
                      />
                    )}
                    {holding.asset_type === "fci" && !fciRate && (
                      <HoldingPriceEdit
                        holdingId={holding.id}
                        currentPrice={holding.current_price}
                        currency={holding.currency}
                      />
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {currentValue != null ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                          {formatCurrency(currentValue, holding.currency)}
                        </p>
                        {pnlPct != null && (
                          <p
                            className={`text-xs font-medium tabular-nums ${
                              pnl! >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {pnl! >= 0 ? "+" : ""}
                            {pnlPct.toFixed(1)}%
                          </p>
                        )}
                        {pnl != null && (
                          <p
                            className={`text-[11px] tabular-nums ${
                              pnl >= 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {pnl >= 0 ? "+" : ""}
                            {formatCurrency(pnl, holding.currency)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Sin precio</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
