import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import HoldingPriceEdit from "./_components/HoldingPriceEdit";
import { FciRateCell, FciPortfolioSummary } from "./_components/FciRatesSection";
import { autoSyncFciHoldings } from "@/lib/fciAutoSync";
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

export default async function InversionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo carga holdings desde Supabase — renderiza inmediatamente.
  // FCI rates se cargan en paralelo por holding via Suspense.
  // El embed de accounts debe desambiguarse: desde la migración 021 hay dos FKs
  // entre holdings y accounts (holdings.account_id -> accounts.id, y
  // accounts.holding_id -> holdings.id), y PostgREST no puede elegir sola cuál
  // usar para "accounts(name)" — devuelve error PGRST201, que quedaba silenciado
  // porque no se chequeaba `error`, dejando data=null y la página vacía para
  // TODOS los holdings, no solo el vinculado desde un bolsillo (Sesión J.1.11).
  const { data } = await supabase
    .from("holdings")
    .select("*, accounts!holdings_account_id_fkey(name)")
    .order("created_at", { ascending: false });

  const holdings = (data ?? []) as HoldingRow[];

  // Auto-sync: actualiza current_price en DB si el VCP del feed difiere.
  // El feed está cacheado 6h por Next.js — no se llama al RPC si el precio no cambió.
  // También actualiza el array en memoria para que FciPortfolioSummary muestre valores frescos.
  const updatedPrices = await autoSyncFciHoldings(supabase, holdings);
  for (const h of holdings) {
    if (updatedPrices.has(h.id)) h.current_price = updatedPrices.get(h.id)!;
  }

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

      <section className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">FCI:</span> TNA actualizada desde ArgentinaDatos (cada 6 h).
          <span className="ml-2 font-medium text-gray-700">Acciones / CEDEARs:</span> sin feed automático — actualizá el precio manualmente.
        </p>
      </section>

      {/* Resumen portafolio — no bloquea, solo usa precios ya guardados en DB */}
      <Suspense fallback={null}>
        <FciPortfolioSummary holdings={holdings} />
      </Suspense>

      {/* Lista de posiciones — holdings renderizan de inmediato */}
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

                    {/* FCI: VCP via Suspense — no bloquea el render de la lista */}
                    {holding.asset_type === "fci" ? (
                      <Suspense
                        fallback={
                          <p className="text-xs text-gray-300 mt-0.5 animate-pulse">
                            Cargando VCP…
                          </p>
                        }
                      >
                        <FciRateCell holding={holding} />
                      </Suspense>
                    ) : (
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
