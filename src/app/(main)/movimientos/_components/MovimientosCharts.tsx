"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/format";
import CategoryPieChart, { type CategorySlice } from "@/components/charts/CategoryPieChart";
import MonthlyComparativaChart, { type MonthBar } from "@/components/charts/MonthlyComparativaChart";
import type { Currency } from "@/types";

// TAREA 2 (Sesión J.1.16): los 3 tipos de gráfico del prototipo de Claude
// Design (torta/barras/línea, selector `chartTypes`), con la corrección
// explícita pedida por el usuario: colores sólidos con buen contraste y
// tooltips reales con fecha/valor/porcentaje al pasar el mouse o tocar — el
// prototipo dibujaba los 3 gráficos "mudos" (solo SVG estático), acá usan
// Recharts con Tooltip. Click en una porción/leyenda de la torta filtra la
// lista por esa categoría (mismo mecanismo `categoryFilter`/`catFilter` del
// prototipo), implementado acá como navegación a la URL con `?categoria=`,
// reusando el filtro server-side que ya existía (Sesión J.1.15, TAREA 6) en
// vez de duplicar lógica de filtrado en el cliente.
//
// TAREA 3 (Sesión J.1.17): reemplaza los colores oklch generados por hue
// aleatorio por categoría (se veían "poco profesionales") por una paleta
// fija de 8 colores curados a mano (ver CategoryPieChart), y reemplaza el
// patrón de "un gráfico de torta por moneda" (dos donuts separados, uno
// vacío la mayoría de las veces) por UN solo bloque con toggle ARS/USD —
// mismo patrón de pill toggle que `PortfolioValueToggle` en /inversiones.
// Nunca convierte ni suma ARS+USD entre sí (principio ya establecido,
// Sesión J.1.14 TAREA 3/8): el toggle solo cambia QUÉ dataset se muestra,
// cada uno en su propia moneda. El render de torta y de barras se extrajo a
// componentes compartidos (`src/components/charts/`) para reusarlos también
// en el resumen de Inicio (TAREA 4), sin duplicar la lógica.

interface LinePoint {
  label: string;
  value: number;
}

interface Props {
  /** Gastos por categoría, agrupados por moneda — nunca se suman entre sí. */
  categoryDataByCurrency: Partial<Record<Currency, CategorySlice[]>>;
  /** Comparativa mensual gastos/ingresos — solo ARS (ver comentario en la página). */
  monthlyComparativa: MonthBar[] | null;
  /** Gasto acumulado del período — solo ARS. */
  cumulativeLine: LinePoint[] | null;
  activeCategory: string | null;
  /** Params de la URL actual (serializables) — Next.js no permite pasar
   * funciones/closures de un Server Component a un Client Component, así que
   * el helper `buildHref` de la página no puede cruzar ese límite. Acá se
   * reconstruye el mismo mecanismo (solo la parte de `categoria`) a partir de
   * los params planos. */
  currentParams: Record<string, string>;
}

type ChartType = "pie" | "bar" | "line";

export default function MovimientosCharts({
  categoryDataByCurrency,
  monthlyComparativa,
  cumulativeLine,
  activeCategory,
  currentParams,
}: Props) {
  const router = useRouter();
  const currencies = (Object.keys(categoryDataByCurrency) as Currency[]).filter(
    (c) => (categoryDataByCurrency[c]?.length ?? 0) > 0
  );
  const [activeCurrency, setActiveCurrency] = useState<Currency>(
    currencies.includes("ARS") ? "ARS" : currencies[0]
  );
  const [chartType, setChartType] = useState<ChartType>("pie");

  const hasExtra = activeCurrency === "ARS" && !!monthlyComparativa && !!cumulativeLine;
  if (currencies.length === 0) return null;

  const categoryData = categoryDataByCurrency[activeCurrency] ?? [];

  function selectCategory(name: string) {
    const merged = { ...currentParams };
    const nextCategoria = activeCategory === name ? null : name;
    if (nextCategoria === null) delete merged.categoria;
    else merged.categoria = nextCategoria;
    const qs = new URLSearchParams(merged).toString();
    router.push(qs ? `/movimientos?${qs}` : "/movimientos");
  }

  function selectCurrency(cur: Currency) {
    setActiveCurrency(cur);
    // Barras/Línea son datasets solo-ARS (ver comentario en la página) — si el
    // usuario pasa a USD estando en esas pestañas, no hay nada que mostrar.
    if (cur !== "ARS" && chartType !== "pie") setChartType("pie");
  }

  const tabs: { key: ChartType; label: string }[] = [{ key: "pie", label: "Torta" }];
  if (hasExtra) tabs.push({ key: "bar", label: "Barras" }, { key: "line", label: "Línea" });

  return (
    <div className="bg-fz-surface border border-fz-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide shrink-0">
          {chartType === "pie" && "Gastos por categoría"}
          {chartType === "bar" && "Gastos vs. ingresos (6 meses)"}
          {chartType === "line" && "Gasto acumulado del período"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {currencies.length > 1 && (
            <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5">
              {currencies.map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => selectCurrency(cur)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    activeCurrency === cur ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          )}
          {tabs.length > 1 && (
            <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChartType(t.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    chartType === t.key ? "bg-fz-accent text-fz-accent-text" : "text-fz-text-secondary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {chartType === "pie" && (
        <CategoryPieChart
          data={categoryData}
          currency={activeCurrency}
          activeCategory={activeCategory}
          onSelect={selectCategory}
        />
      )}

      {chartType === "bar" && monthlyComparativa && <MonthlyComparativaChart data={monthlyComparativa} />}

      {chartType === "line" && cumulativeLine && (
        <div style={{ width: "100%", height: 160 }}>
          {cumulativeLine.length < 2 ? (
            <p className="text-xs text-fz-text-tertiary text-center pt-14">
              Necesitás al menos 2 días con gastos en el período para ver la curva.
            </p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={cumulativeLine} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--fz-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--fz-text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), "ARS")}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--fz-accent)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--fz-accent)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
