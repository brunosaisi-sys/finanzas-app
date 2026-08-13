import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, Receipt, SlidersHorizontal } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Money } from "@/components/Money";
import MovimientosCharts from "./_components/MovimientosCharts";
import { aggregateCategoryTotals, fetchMonthlyComparativa } from "@/lib/queries/movimientosSummary";
import type { Currency } from "@/types";

function mesLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function prevMes(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMes(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDate(d: Date) {
  return d.toISOString().split("T")[0];
}

// Lunes a domingo de la semana que contiene `now` (Sesión J.1.14, TAREA 8a).
function weekRange(now: Date): { desde: string; hasta: string } {
  const day = now.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { desde: fmtDate(monday), hasta: fmtDate(sunday) };
}

function fmtShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// TAREA 2 (Sesión J.1.16): el gráfico de torta agrupa gastos sin categoría
// bajo esta etiqueta (para no dejarlos fuera del 100%) y el click en esa
// porción navega con ?categoria=Sin+categoría — pero esa etiqueta no es un
// valor real de `sub` (que para esos gastos es `null`, no el string "Sin
// categoría"). Sin este caso especial, filtrar por esa etiqueta comparaba
// `null === "Sin categoría"` y devolvía siempre 0 resultados (bug real
// encontrado en el QA de esta sesión, con datos reales — ver
// docs/lecciones-aprendidas.md).
const SIN_CATEGORIA = "Sin categoría";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    range?: string;
    desde?: string;
    hasta?: string;
    categoria?: string;
    montoMin?: string;
    montoMax?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const {
    mes,
    range,
    desde: desdeParam,
    hasta: hastaParam,
    categoria: categoriaParam,
    montoMin: montoMinParam,
    montoMax: montoMaxParam,
  } = await searchParams;

  // Sesión J.1.14, TAREA 8a: "esta semana" y "rango personalizado" son modos
  // nuevos; "este mes" (default) y "mes pasado" siguen siendo el mismo mecanismo
  // de navegación por mes que ya existía (mes=<yyyy-mm>) — un "mes pasado" no es
  // más que un link a mes=prevMes(actual), sin necesidad de un modo aparte.
  const isWeek = range === "semana";
  const isCustom = range === "custom" && desdeParam && hastaParam;
  const yearMonth = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentYearMonth();

  let desde: string;
  let hasta: string;
  let periodLabel: string;
  if (isWeek) {
    const w = weekRange(new Date());
    desde = w.desde;
    hasta = w.hasta;
    periodLabel = `${fmtShort(desde)} – ${fmtShort(hasta)}`;
  } else if (isCustom) {
    desde = desdeParam!;
    hasta = hastaParam!;
    periodLabel = `${fmtShort(desde)} – ${fmtShort(hasta)}`;
  } else {
    desde = `${yearMonth}-01`;
    hasta = `${yearMonth}-31`;
    periodLabel = mesLabel(yearMonth);
  }

  // TAREA 6 (Sesión J.1.15): filtro de categoría y rango de monto, combinables
  // entre sí y con el filtro de período ya existente (Sesión J.1.14, TAREA 8a).
  const montoMin = montoMinParam ? parseFloat(montoMinParam) : null;
  const montoMax = montoMaxParam ? parseFloat(montoMaxParam) : null;
  const hasExtraFilters = !!categoriaParam || montoMin != null || montoMax != null;

  const [{ data: expensesData }, { data: incomesData }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, amount, currency, merchant, description, date, categories(name, icon), account:accounts!account_id(name)"
      )
      .gte("date", desde)
      .lte("date", hasta)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("incomes")
      .select("id, amount, currency, type, note, date, account:accounts!account_id(name)")
      .gte("date", desde)
      .lte("date", hasta)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  type ExpenseRow = {
    id: string;
    amount: number;
    currency: string;
    merchant: string | null;
    description: string | null;
    date: string;
    categories: { name: string; icon: string | null } | null;
    account?: { name: string } | null;
  };
  type IncomeRow = {
    id: string;
    amount: number;
    currency: string;
    type: string;
    note: string | null;
    date: string;
    account?: { name: string } | null;
  };

  const expenses = ((expensesData ?? []) as unknown as ExpenseRow[]).map((e) => ({
    kind: "gasto" as const,
    id: e.id,
    amount: Number(e.amount),
    currency: e.currency as Currency,
    label: e.merchant || e.description || (e.categories as ExpenseRow["categories"])?.name || "Gasto",
    sub: (e.categories as ExpenseRow["categories"])?.name ?? null,
    account: (e as unknown as { account?: { name: string } | null }).account?.name ?? null,
    icon: (e.categories as ExpenseRow["categories"])?.icon ?? "💸",
    hasCategoryIcon: !!(e.categories as ExpenseRow["categories"])?.icon,
    date: e.date,
    href: `/gastos/${e.id}/editar`,
  }));

  const incomes = ((incomesData ?? []) as unknown as IncomeRow[]).map((i) => {
    const typeLabel =
      i.type === "sueldo" ? "Sueldo" : i.type === "freelance" ? "Freelance" : "Ingreso";
    return {
      kind: "ingreso" as const,
      id: i.id,
      amount: Number(i.amount),
      currency: i.currency as Currency,
      label: i.note ? `${typeLabel} · ${i.note}` : typeLabel,
      sub: null as string | null,
      account: (i as unknown as { account?: { name: string } | null }).account?.name ?? null,
      icon: "💰",
      date: i.date,
      href: `/ingresos/${i.id}/editar`,
    };
  });

  // Opciones de categoría para el filtro — solo categorías con gastos en este
  // período (date-filtrado, antes de aplicar categoría/monto), para no ofrecer
  // categorías vacías.
  const categoryOptions = Array.from(
    new Map(
      expenses.filter((e) => e.sub).map((e) => [e.sub as string, e.icon])
    ).entries()
  ).sort((a, b) => a[0].localeCompare(b[0]));

  // Las incomes no tienen categoría — un filtro de categoría activo las excluye
  // (semánticamente "quiero ver los gastos de tal categoría").
  let filteredExpenses = expenses;
  let filteredIncomes = categoriaParam ? [] : incomes;
  if (categoriaParam) {
    filteredExpenses = filteredExpenses.filter((e) =>
      categoriaParam === SIN_CATEGORIA ? e.sub == null : e.sub === categoriaParam
    );
  }
  if (montoMin != null) {
    filteredExpenses = filteredExpenses.filter((e) => e.amount >= montoMin);
    filteredIncomes = filteredIncomes.filter((i) => i.amount >= montoMin);
  }
  if (montoMax != null) {
    filteredExpenses = filteredExpenses.filter((e) => e.amount <= montoMax);
    filteredIncomes = filteredIncomes.filter((i) => i.amount <= montoMax);
  }

  // Merge y ordenar por fecha desc (ambas listas ya vienen ordenadas, merge manual)
  const all = [...filteredExpenses, ...filteredIncomes].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const totalGastos = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIngresos = filteredIncomes.reduce((s, i) => s + i.amount, 0);
  const isCurrent = !isWeek && !isCustom && yearMonth === currentYearMonth();
  const activeFilter = isWeek ? "semana" : isCustom ? "custom" : yearMonth === currentYearMonth() ? "mes" : yearMonth === prevMes(currentYearMonth()) ? "mes_pasado" : "mes";

  // TAREA 8b (Sesión J.1.14) / TAREA 2 (Sesión J.1.16): gastos por categoría,
  // agrupados por moneda (nunca sumados entre monedas distintas — mismo
  // principio que TAREA 3 de Sesión J.1.14). Se construye a partir de
  // filteredExpenses, para que el gráfico refleje también el filtro de
  // categoría/monto de TAREA 6. Agregación extraída a
  // lib/queries/movimientosSummary.ts (Sesión J.1.17, TAREA 4) para reusar
  // la misma lógica en el resumen de Inicio, sin duplicarla.
  const categoryDataByCurrency = aggregateCategoryTotals(filteredExpenses);

  // TAREA 2a (Sesión J.1.16): gráfico de barras "gastos vs. ingresos" — 6
  // meses calendario terminando en el mes actual real (independiente del
  // período navegado arriba, igual criterio que el prototipo). Solo ARS: es
  // la moneda ampliamente dominante en la app y evita sumar monedas distintas
  // en un mismo total (regla dura del proyecto) — limitación documentada, no
  // un descarte silencioso. Query extraída a movimientosSummary.ts (TAREA 4).
  const monthlyComparativa = await fetchMonthlyComparativa(supabase);

  // TAREA 2a: gasto acumulado día a día DENTRO del período navegado, solo ARS
  // (mismo motivo que arriba), a partir de filteredExpenses (respeta filtro
  // de categoría/monto — a diferencia de la comparativa mensual, acá sí tiene
  // sentido: "cuánto llevo gastado en lo que estoy mirando").
  const arsExpensesInPeriod = filteredExpenses.filter((e) => e.currency === "ARS");
  const dayTotals = new Map<string, number>();
  for (const e of arsExpensesInPeriod) {
    dayTotals.set(e.date, (dayTotals.get(e.date) ?? 0) + e.amount);
  }
  const sortedDays = Array.from(dayTotals.keys()).sort();
  let running = 0;
  const cumulativeLine = sortedDays.map((day) => {
    running += dayTotals.get(day)!;
    return { label: fmtShort(day), value: running };
  });

  // Helper para combinar filtros: cualquier link/form de esta página parte de
  // los params actuales y solo pisa los que le corresponden — así el filtro de
  // categoría/monto sobrevive a un cambio de período y viceversa (TAREA 6:
  // "los filtros deben poder combinarse").
  const currentParams: Record<string, string> = {};
  if (mes) currentParams.mes = mes;
  if (range) currentParams.range = range;
  if (desdeParam) currentParams.desde = desdeParam;
  if (hastaParam) currentParams.hasta = hastaParam;
  if (categoriaParam) currentParams.categoria = categoriaParam;
  if (montoMinParam) currentParams.montoMin = montoMinParam;
  if (montoMaxParam) currentParams.montoMax = montoMaxParam;

  function buildHref(overrides: Record<string, string | null>): string {
    const merged = { ...currentParams };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    const qs = new URLSearchParams(merged).toString();
    return qs ? `/movimientos?${qs}` : "/movimientos";
  }

  const pillClass = (active: boolean) =>
    `text-xs font-medium rounded-full px-3 py-1.5 transition-colors shrink-0 ${
      active ? "bg-fz-accent text-fz-accent-text" : "bg-fz-surface-high text-fz-text-secondary"
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24 bg-fz-bg min-h-screen -mt-[1px]">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-display font-extrabold text-[28px] leading-none text-fz-text uppercase tracking-wide">
          Movimientos
        </h1>
        <div className="flex gap-2">
          <Link
            href="/gastos/nuevo"
            className="text-xs font-medium text-fz-text-secondary bg-fz-surface-high hover:opacity-80 rounded-full px-3 py-1.5 transition-opacity"
          >
            + Gasto
          </Link>
          <Link
            href="/ingresos/nuevo"
            className="text-xs font-medium text-fz-accent-text bg-fz-accent hover:opacity-90 rounded-full px-3 py-1.5 transition-opacity"
          >
            + Ingreso
          </Link>
        </div>
      </div>

      {/* Filtro de período (TAREA 8a) */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Link
          href={buildHref({ range: "semana", mes: null, desde: null, hasta: null })}
          className={pillClass(activeFilter === "semana")}
        >
          Esta semana
        </Link>
        <Link
          href={buildHref({ range: null, mes: null, desde: null, hasta: null })}
          className={pillClass(activeFilter === "mes")}
        >
          Este mes
        </Link>
        <Link
          href={buildHref({ range: null, mes: prevMes(currentYearMonth()), desde: null, hasta: null })}
          className={pillClass(activeFilter === "mes_pasado")}
        >
          Mes pasado
        </Link>
        <details className="relative shrink-0">
          <summary className={`${pillClass(activeFilter === "custom")} list-none cursor-pointer`}>
            Rango personalizado
          </summary>
          <form
            method="GET"
            action="/movimientos"
            className="absolute right-0 mt-2 z-10 bg-fz-surface rounded-xl shadow-lg border border-fz-border p-3 space-y-2 w-64"
          >
            <input type="hidden" name="range" value="custom" />
            {categoriaParam && <input type="hidden" name="categoria" value={categoriaParam} />}
            {montoMinParam && <input type="hidden" name="montoMin" value={montoMinParam} />}
            {montoMaxParam && <input type="hidden" name="montoMax" value={montoMaxParam} />}
            <div>
              <label className="block text-[10px] text-fz-text-tertiary mb-0.5">Desde</label>
              <input
                type="date"
                name="desde"
                defaultValue={isCustom ? desde : desde}
                required
                className="w-full border border-fz-border bg-fz-bg text-fz-text rounded-lg px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-fz-text-tertiary mb-0.5">Hasta</label>
              <input
                type="date"
                name="hasta"
                defaultValue={isCustom ? hasta : hasta}
                required
                className="w-full border border-fz-border bg-fz-bg text-fz-text rounded-lg px-2 py-1 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-fz-accent text-fz-accent-text rounded-lg py-1.5 text-xs font-medium"
            >
              Aplicar
            </button>
          </form>
        </details>

        {/* TAREA 6: filtros de categoría + rango de monto, combinables con el
            período elegido arriba (hidden inputs preservan mes/range/desde/hasta). */}
        <details className="relative shrink-0">
          <summary className={`${pillClass(hasExtraFilters)} list-none cursor-pointer flex items-center gap-1`}>
            <SlidersHorizontal size={12} />
            {hasExtraFilters ? "Filtros ✓" : "Más filtros"}
          </summary>
          <form
            method="GET"
            action="/movimientos"
            className="absolute right-0 mt-2 z-10 bg-fz-surface rounded-xl shadow-lg border border-fz-border p-3 space-y-2 w-64"
          >
            {mes && <input type="hidden" name="mes" value={mes} />}
            {range && <input type="hidden" name="range" value={range} />}
            {desdeParam && <input type="hidden" name="desde" value={desdeParam} />}
            {hastaParam && <input type="hidden" name="hasta" value={hastaParam} />}
            <div>
              <label className="block text-[10px] text-fz-text-tertiary mb-0.5">Categoría</label>
              <select
                name="categoria"
                defaultValue={categoriaParam ?? ""}
                className="w-full border border-fz-border bg-fz-bg text-fz-text rounded-lg px-2 py-1 text-xs"
              >
                <option value="">Todas</option>
                {categoryOptions.map(([name, icon]) => (
                  <option key={name} value={name}>
                    {icon} {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-fz-text-tertiary mb-0.5">Monto mín.</label>
                <input
                  type="number"
                  name="montoMin"
                  step="0.01"
                  min="0"
                  defaultValue={montoMinParam ?? ""}
                  className="w-full border border-fz-border bg-fz-bg text-fz-text rounded-lg px-2 py-1 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-fz-text-tertiary mb-0.5">Monto máx.</label>
                <input
                  type="number"
                  name="montoMax"
                  step="0.01"
                  min="0"
                  defaultValue={montoMaxParam ?? ""}
                  className="w-full border border-fz-border bg-fz-bg text-fz-text rounded-lg px-2 py-1 text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-fz-text-tertiary">
              El rango de monto se aplica en la moneda propia de cada movimiento (sin convertir).
            </p>
            <div className="flex gap-2">
              {hasExtraFilters && (
                <Link
                  href={buildHref({ categoria: null, montoMin: null, montoMax: null })}
                  className="flex-1 text-center border border-fz-border text-fz-text-secondary rounded-lg py-1.5 text-xs font-medium"
                >
                  Limpiar
                </Link>
              )}
              <button
                type="submit"
                className="flex-1 bg-fz-accent text-fz-accent-text rounded-lg py-1.5 text-xs font-medium"
              >
                Aplicar
              </button>
            </div>
          </form>
        </details>
      </div>

      {/* Navegador de mes — solo tiene sentido en modo "mes" */}
      {!isWeek && !isCustom && (
        <div className="flex items-center justify-between bg-fz-surface border border-fz-border rounded-2xl px-4 py-3">
          <Link
            href={buildHref({ mes: prevMes(yearMonth) })}
            className="text-fz-text-tertiary hover:text-fz-text transition-colors text-lg px-2 py-1"
            aria-label="Mes anterior"
          >
            ‹
          </Link>
          <span className="text-sm font-medium text-fz-text capitalize">
            {periodLabel}
          </span>
          <Link
            href={isCurrent ? buildHref({ mes: null }) : buildHref({ mes: nextMes(yearMonth) })}
            className={`text-lg px-2 py-1 transition-colors ${
              isCurrent ? "text-fz-border pointer-events-none" : "text-fz-text-tertiary hover:text-fz-text"
            }`}
            aria-label="Mes siguiente"
            aria-disabled={isCurrent}
          >
            ›
          </Link>
        </div>
      )}
      {(isWeek || isCustom) && (
        <div className="bg-fz-surface border border-fz-border rounded-2xl px-4 py-3 text-center">
          <span className="text-sm font-medium text-fz-text">{periodLabel}</span>
        </div>
      )}

      {/* Resumen rápido */}
      {all.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-fz-negative-soft rounded-xl px-4 py-3">
            <p className="text-[11px] text-fz-negative font-medium uppercase tracking-wide">Gastos</p>
            <p className="text-lg font-bold text-fz-text tabular-nums font-mono">
              <Money>{formatCurrency(totalGastos, "ARS")}</Money>
            </p>
          </div>
          <div className="bg-fz-accent-soft rounded-xl px-4 py-3">
            <p className="text-[11px] text-fz-accent font-medium uppercase tracking-wide">Ingresos</p>
            <p className="text-lg font-bold text-fz-text tabular-nums font-mono">
              <Money>{formatCurrency(totalIngresos, "ARS")}</Money>
            </p>
          </div>
        </div>
      )}

      {/* Gráficos (TAREA 2 Sesión J.1.16, rediseñado TAREA 3 Sesión J.1.17) —
          un solo bloque con toggle ARS/USD en vez de un donut separado por
          moneda (antes aparecían dos, uno vacío la mayoría de las veces).
          Barras/línea siguen siendo datasets solo-ARS (ver comentario arriba
          de monthlyComparativa/cumulativeLine). */}
      {Object.keys(categoryDataByCurrency).length > 0 && (
        <MovimientosCharts
          categoryDataByCurrency={categoryDataByCurrency}
          monthlyComparativa={monthlyComparativa}
          cumulativeLine={cumulativeLine}
          activeCategory={categoriaParam ?? null}
          currentParams={currentParams}
        />
      )}

      {/* Chip de filtro activo (categoría, aplicado por click en el gráfico o el form de filtros) */}
      {categoriaParam && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-fz-text-secondary">Filtrando por</span>
          <Link
            href={buildHref({ categoria: null })}
            className="flex items-center gap-1.5 bg-fz-accent-soft text-fz-accent rounded-full pl-3 pr-2 py-1 text-xs font-bold"
          >
            {categoriaParam} <span className="font-extrabold">×</span>
          </Link>
        </div>
      )}

      {/* Lista unificada */}
      {all.length === 0 ? (
        <div className="bg-fz-surface border border-fz-border rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-fz-text-tertiary">
            {hasExtraFilters ? "Sin movimientos con estos filtros" : `Sin movimientos en ${periodLabel}`}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/gastos/nuevo" className="text-sm font-medium text-fz-text underline">
              Registrar gasto
            </Link>
            <span className="text-fz-border">·</span>
            <Link href="/ingresos/nuevo" className="text-sm font-medium text-fz-text underline">
              Registrar ingreso
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-fz-surface border border-fz-border rounded-2xl overflow-hidden">
          {all.map((item, i) => {
            const dateStr = fmtShort(item.date);
            const isIngreso = item.kind === "ingreso";
            return (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className={`flex items-center justify-between px-4 py-3 hover:bg-fz-surface-high transition-colors ${
                  i > 0 ? "border-t border-fz-border" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Indicador de tipo */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${
                      isIngreso ? "bg-fz-accent-soft" : "bg-fz-surface-high"
                    }`}
                  >
                    {isIngreso ? (
                      <Wallet size={16} className="text-fz-accent" />
                    ) : "hasCategoryIcon" in item && item.hasCategoryIcon ? (
                      item.icon
                    ) : (
                      <Receipt size={16} className="text-fz-text-tertiary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fz-text truncate">{item.label}</p>
                    <p className="text-xs text-fz-text-tertiary truncate">
                      {dateStr}
                      {item.account && <> · {item.account}</>}
                      {item.sub && !isIngreso && <> · {item.sub}</>}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold tabular-nums font-mono ml-3 shrink-0 ${
                    isIngreso ? "text-fz-accent" : "text-fz-text"
                  }`}
                >
                  {isIngreso ? "+" : "−"}
                  <Money>{formatCurrency(item.amount, item.currency)}</Money>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
