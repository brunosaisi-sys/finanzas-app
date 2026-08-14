import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Money } from "@/components/Money";
import HoldingPriceEdit from "./_components/HoldingPriceEdit";
import HoldingPositionEdit from "./_components/HoldingPositionEdit";
import DeleteHoldingButton from "./_components/DeleteHoldingButton";
import InversionesChart from "./_components/InversionesChart";
import { FciRateCell, FciPortfolioSummary } from "./_components/FciRatesSection";
import { calcHoldingReturn } from "@/lib/finance/holdingReturn";
import { fetchInvestmentsSummary } from "@/lib/queries/investmentsSummary";

const ASSET_LABELS: Record<string, string> = {
  accion: "Acción",
  cedear: "CEDEAR",
  bono: "Bono",
  fci: "FCI",
  crypto: "Crypto",
  otro: "Otro",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// TAREA 4b (Sesión J.1.15): selector de período — recalcula el retorno de cada
// posición sobre la ventana elegida en vez de solo 30 días fijos. calcHoldingReturn
// ya aceptaba un windowDays genérico (Sesión J.1.7) — no hacía falta tocar el motor,
// solo variar el parámetro según el período elegido acá.
function windowStartForPeriod(periodo: "mes" | "anio", now: Date): Date {
  return periodo === "anio"
    ? new Date(now.getFullYear(), 0, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
}

function windowDaysForPeriod(periodo: "mes" | "anio", now: Date): number {
  const start = windowStartForPeriod(periodo, now);
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

  // TAREA 3: cuentas vinculadas a un holding (accounts.holding_id) — distinto de
  // holdings.account_id (el "dueño"/broker, solo informativo). Un holding
  // vinculado no se puede borrar directo, hay que desvincularlo primero.
  const now = new Date();
  const windowStart = windowStartForPeriod(periodo, now);
  const windowDays = windowDaysForPeriod(periodo, now);

  // Fetch + auto-sync + histórico + evolución del portafolio: extraído a
  // lib/queries/investmentsSummary.ts (Sesión J.1.17, TAREA 4) para reusar
  // exactamente la misma lógica en el resumen de Inversiones de Inicio, sin
  // duplicarla. El embed de accounts se desambigua adentro del helper (dos FKs
  // entre holdings y accounts desde la migración 021 — ver Sesión J.1.11).
  const [{ holdings, portfolioLinePoints, historyByHolding }, { data: linkedAccountsData }] = await Promise.all([
    fetchInvestmentsSummary(supabase, windowStart, now),
    supabase.from("accounts").select("id, name, holding_id").not("holding_id", "is", null),
  ]);
  const linkedAccountByHoldingId = new Map<string, string>();
  for (const a of linkedAccountsData ?? []) {
    if (a.holding_id) linkedAccountByHoldingId.set(a.holding_id, a.name);
  }

  // Retorno sobre el período elegido (§8.5/§8.7 fundamentos) a partir del histórico
  // propio de cada holding — hoy solo FCI acumula histórico real (auto-sync);
  // acciones/CEDEARs con precio manual no tienen suficientes puntos y
  // simplemente no muestran nada (Sesión J.1.13, TAREA 6, regla dura: nunca
  // inventar el número).
  const returnByHolding = new Map<string, number | null>();
  for (const h of holdings) {
    const history = historyByHolding.get(h.id);
    if (history && history.length > 0) returnByHolding.set(h.id, calcHoldingReturn(history, windowDays));
  }

  const periodLabel = periodo === "anio" ? "este año" : "este mes";

  if (holdings.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto bg-fz-bg min-h-screen -mt-[1px]">
        <div className="flex items-center justify-between pt-2 mb-6">
          <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
            Inversiones
          </h1>
          <Link
            href="/inversiones/nueva"
            className="text-sm font-medium bg-fz-text text-fz-bg px-3 py-1.5 rounded-lg"
          >
            + Agregar
          </Link>
        </div>
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-fz-accent-soft flex items-center justify-center mx-auto">
            <TrendingUp size={26} className="text-fz-accent" />
          </div>
          <p className="text-sm font-medium text-fz-text">Sin posiciones cargadas</p>
          <p className="text-sm text-fz-text-tertiary">
            Cargá tus acciones, CEDEARs, bonos o FCI para ver tu portafolio y rendimiento.
          </p>
          <Link
            href="/inversiones/nueva"
            className="inline-block mt-2 text-sm font-medium text-fz-text underline"
          >
            Cargar primera posición
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 pb-24 bg-fz-bg min-h-screen -mt-[1px]">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display font-extrabold text-2xl text-fz-text uppercase tracking-wide">
          Inversiones
        </h1>
        <Link
          href="/inversiones/nueva"
          className="text-sm font-medium bg-fz-text text-fz-bg px-3 py-1.5 rounded-lg"
        >
          + Agregar
        </Link>
      </div>

      {/* Resumen portafolio — no bloquea, solo usa precios ya guardados en DB */}
      <Suspense fallback={null}>
        <FciPortfolioSummary holdings={holdings} />
      </Suspense>

      {/* TAREA 3a/3b: evolución del valor del portafolio — gráfico faltante del
          prototipo, agregado acá con colores sólidos + tooltip real. */}
      <section className="bg-fz-surface border border-fz-border rounded-2xl p-4">
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide mb-3">
          Evolución del portafolio · {periodLabel}
        </p>
        <InversionesChart points={portfolioLinePoints} />
        {portfolioLinePoints.length >= 2 && (
          <p className="text-[10px] text-fz-text-tertiary mt-2">
            Estimado a partir del historial de precios disponible — no todos los activos
            tienen historial diario (ver detalle en fundamentos §8.8).
          </p>
        )}
      </section>

      {/* TAREA 4b: selector de período — solo afecta el %/valor de rendimiento
          de cada posición (ver windowDaysForPeriod) y el gráfico de arriba, no
          el valor total del portafolio (ese es "hoy", period-agnostic). */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-fz-text-tertiary">Rendimiento de:</span>
        <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5 text-xs">
          <Link
            href="/inversiones?periodo=mes"
            className={`px-3 py-1 rounded-md font-bold transition-colors ${
              periodo === "mes" ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
            }`}
          >
            Este mes
          </Link>
          <Link
            href="/inversiones?periodo=anio"
            className={`px-3 py-1 rounded-md font-bold transition-colors ${
              periodo === "anio" ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
            }`}
          >
            Este año
          </Link>
        </div>
      </div>

      {/* Lista de posiciones — holdings renderizan de inmediato */}
      <section>
        <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden divide-y divide-fz-border">
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
            const isFci = holding.asset_type === "fci";

            return (
              <div key={holding.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  {/* TAREA 4a/d: el nombre y el valor son lo primero que se ve —
                      ticker/tipo/VCP/PA quedan colapsados en "Detalles técnicos". */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fz-text truncate">
                      {holding.name}
                    </p>
                    {holding.accounts && (
                      <p className="text-xs text-fz-text-tertiary">{holding.accounts.name}</p>
                    )}

                    {currentValue != null && pnlPct != null && (
                      <p className="text-xs mt-1 font-mono">
                        <span
                          className={`font-semibold tabular-nums ${
                            pnl! >= 0 ? "text-fz-accent" : "text-fz-negative"
                          }`}
                        >
                          {pnl! >= 0 ? "+" : ""}
                          {pnlPct.toFixed(1)}% ({pnl! >= 0 ? "+" : ""}
                          {formatCurrency(pnl!, holding.currency)})
                        </span>
                        {isFci && <span className="text-fz-text-tertiary ml-1 font-sans">estimado</span>}
                      </p>
                    )}

                    {periodReturn != null && (
                      <div className="mt-1">
                        <p className="text-xs font-mono">
                          <span
                            className={`font-medium tabular-nums ${
                              periodReturn >= 0 ? "text-fz-accent" : "text-fz-negative"
                            }`}
                          >
                            {periodReturn >= 0 ? "+" : ""}
                            {(periodReturn * 100).toFixed(1)}% · {periodLabel}
                          </span>
                        </p>
                        {isFci && (
                          <p className="text-[10px] text-fz-text-tertiary">
                            rendimiento realizado — la app no tiene acceso a la TNA oficial del fondo
                          </p>
                        )}
                      </div>
                    )}

                    <details className="mt-1.5 group">
                      <summary className="text-[11px] text-fz-text-tertiary cursor-pointer select-none">
                        Detalles técnicos
                      </summary>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-xs text-fz-text-tertiary">
                          {ASSET_LABELS[holding.asset_type]}
                          {holding.ticker && (
                            <span className="ml-1.5 font-mono font-bold bg-fz-surface-high text-fz-text-secondary px-1.5 py-0.5 rounded text-[10px]">
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
                              <p className="text-xs text-fz-text-tertiary animate-pulse">
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
                      <p className="font-display font-extrabold text-2xl text-fz-text tabular-nums">
                        <Money>{formatCurrency(currentValue, holding.currency)}</Money>
                      </p>
                    ) : (
                      <p className="text-xs text-fz-text-tertiary italic">Sin precio</p>
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
