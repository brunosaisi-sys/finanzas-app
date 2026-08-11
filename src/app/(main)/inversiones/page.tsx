import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import HoldingPriceEdit from "./_components/HoldingPriceEdit";
import HoldingPositionEdit from "./_components/HoldingPositionEdit";
import DeleteHoldingButton from "./_components/DeleteHoldingButton";
import { FciRateCell, FciPortfolioSummary } from "./_components/FciRatesSection";
import { autoSyncFciHoldings } from "@/lib/fciAutoSync";
import { calcHoldingReturn, calcAnnualizedReturn, type PricePoint } from "@/lib/finance/holdingReturn";
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// TAREA 4b (Sesión J.1.15): selector de período — recalcula el retorno de cada
// posición sobre la ventana elegida en vez de solo 30 días fijos. calcHoldingReturn
// ya aceptaba un windowDays genérico (Sesión J.1.7) — no hacía falta tocar el motor,
// solo variar el parámetro según el período elegido acá.
function windowDaysForPeriod(periodo: "mes" | "anio", now: Date): number {
  const start =
    periodo === "anio"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / MS_PER_DAY));
}

export default async function InversionesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo: periodoParam } = await searchParams;
  const periodo: "mes" | "anio" = periodoParam === "anio" ? "anio" : "mes";

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
  const [{ data }, { data: linkedAccountsData }] = await Promise.all([
    supabase
      .from("holdings")
      .select("*, accounts!holdings_account_id_fkey(name)")
      .order("created_at", { ascending: false }),
    // TAREA 3: cuentas vinculadas a un holding (accounts.holding_id) — distinto de
    // holdings.account_id (el "dueño"/broker, solo informativo). Un holding
    // vinculado no se puede borrar directo, hay que desvincularlo primero.
    supabase.from("accounts").select("id, name, holding_id").not("holding_id", "is", null),
  ]);

  const holdings = (data ?? []) as HoldingRow[];
  const linkedAccountByHoldingId = new Map<string, string>();
  for (const a of linkedAccountsData ?? []) {
    if (a.holding_id) linkedAccountByHoldingId.set(a.holding_id, a.name);
  }

  // Auto-sync: actualiza current_price en DB si el VCP del feed difiere.
  // El feed está cacheado 6h por Next.js — no se llama al RPC si el precio no cambió.
  // También actualiza el array en memoria para que FciPortfolioSummary muestre valores frescos.
  const updatedPrices = await autoSyncFciHoldings(supabase, holdings);
  for (const h of holdings) {
    if (updatedPrices.has(h.id)) h.current_price = updatedPrices.get(h.id)!;
  }

  // Retorno sobre el período elegido (§8.5/§8.7 fundamentos) a partir del histórico
  // propio de cada holding — hoy solo FCI acumula histórico real (auto-sync);
  // acciones/CEDEARs con precio manual no tienen suficientes puntos y
  // simplemente no muestran nada (Sesión J.1.13, TAREA 6, regla dura: nunca
  // inventar el número). Best-effort: si holding_price_history no existe
  // todavía, no bloquea el render de la lista.
  const windowDays = windowDaysForPeriod(periodo, new Date());
  const returnByHolding = new Map<string, number | null>();
  if (holdings.length > 0) {
    try {
      const { data: historyRows } = await supabase
        .from("holding_price_history")
        .select("holding_id, price, recorded_at")
        .in("holding_id", holdings.map((h) => h.id));
      const historyByHolding = new Map<string, PricePoint[]>();
      for (const row of historyRows ?? []) {
        const arr = historyByHolding.get(row.holding_id) ?? [];
        arr.push({ price: Number(row.price), recorded_at: row.recorded_at });
        historyByHolding.set(row.holding_id, arr);
      }
      for (const h of holdings) {
        const history = historyByHolding.get(h.id);
        if (history) returnByHolding.set(h.id, calcHoldingReturn(history, windowDays));
      }
    } catch {
      // holding_price_history todavía no existe — sin rendimiento, no bloquea
    }
  }

  const periodLabel = periodo === "anio" ? "este año" : "este mes";

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
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
            <TrendingUp size={26} className="text-indigo-600" />
          </div>
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

      {/* Resumen portafolio — no bloquea, solo usa precios ya guardados en DB */}
      <Suspense fallback={null}>
        <FciPortfolioSummary holdings={holdings} />
      </Suspense>

      {/* TAREA 4b: selector de período — solo afecta el %/valor de rendimiento
          de cada posición (ver windowDaysForPeriod), no el valor total del
          portafolio de arriba (ese es "hoy", period-agnostic). */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Rendimiento de:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
          <Link
            href="/inversiones?periodo=mes"
            className={`px-3 py-1 font-medium transition-colors ${
              periodo === "mes" ? "bg-gray-900 text-white" : "bg-white text-gray-500"
            }`}
          >
            Este mes
          </Link>
          <Link
            href="/inversiones?periodo=anio"
            className={`px-3 py-1 font-medium transition-colors ${
              periodo === "anio" ? "bg-gray-900 text-white" : "bg-white text-gray-500"
            }`}
          >
            Este año
          </Link>
        </div>
      </div>

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
            const periodReturn = returnByHolding.get(holding.id) ?? null;
            const tnaEstimada = calcAnnualizedReturn(periodReturn);
            const isFci = holding.asset_type === "fci";

            return (
              <div key={holding.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  {/* TAREA 4a/d: el nombre y el valor son lo primero que se ve —
                      ticker/tipo/VCP/PA quedan colapsados en "Detalles técnicos". */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {holding.name}
                    </p>
                    {holding.accounts && (
                      <p className="text-xs text-gray-300">{holding.accounts.name}</p>
                    )}

                    {currentValue != null && pnlPct != null && (
                      <p className="text-xs mt-1">
                        <span
                          className={`font-semibold tabular-nums ${
                            pnl! >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {pnl! >= 0 ? "+" : ""}
                          {pnlPct.toFixed(1)}% ({pnl! >= 0 ? "+" : ""}
                          {formatCurrency(pnl!, holding.currency)})
                        </span>
                        {isFci && <span className="text-gray-300 ml-1">estimado</span>}
                      </p>
                    )}

                    {periodReturn != null && (
                      <div className="mt-1">
                        <p className="text-xs">
                          <span
                            className={`font-medium tabular-nums ${
                              periodReturn >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {periodReturn >= 0 ? "+" : ""}
                            {(periodReturn * 100).toFixed(1)}% · {periodLabel}
                          </span>
                          {tnaEstimada != null && (
                            <span className="text-gray-400 ml-1.5">
                              TNA estimada {tnaEstimada >= 0 ? "+" : ""}
                              {(tnaEstimada * 100).toFixed(0)}%
                            </span>
                          )}
                        </p>
                        {tnaEstimada != null && (
                          <p className="text-[10px] text-gray-300">
                            proyectada del último mes, no garantizada
                          </p>
                        )}
                      </div>
                    )}

                    <details className="mt-1.5 group">
                      <summary className="text-[11px] text-gray-400 cursor-pointer select-none">
                        Detalles técnicos
                      </summary>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-xs text-gray-400">
                          {ASSET_LABELS[holding.asset_type]}
                          {holding.ticker && (
                            <span className="ml-1.5 font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                              {holding.ticker}
                            </span>
                          )}
                          {" · "}
                          {holding.quantity} u. · PA{" "}
                          {formatCurrency(holding.avg_buy_price, holding.currency)}
                        </p>

                        {isFci ? (
                          <Suspense
                            fallback={
                              <p className="text-xs text-gray-300 animate-pulse">
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
                        <HoldingPositionEdit
                          holdingId={holding.id}
                          quantity={holding.quantity}
                          avgBuyPrice={holding.avg_buy_price}
                          currency={holding.currency}
                        />
                        <DeleteHoldingButton
                          holdingId={holding.id}
                          linkedAccountName={linkedAccountByHoldingId.get(holding.id) ?? null}
                        />
                      </div>
                    </details>
                  </div>

                  <div className="text-right shrink-0">
                    {currentValue != null ? (
                      <p className="text-xl font-bold text-gray-900 tabular-nums">
                        {formatCurrency(currentValue, holding.currency)}
                      </p>
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
