"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

// TAREA 2 (Sesión J.1.16): los 3 tipos de gráfico del prototipo de Claude
// Design (torta/barras/línea, selector `chartTypes`), con la corrección
// explícita pedida por el usuario: colores sólidos con buen contraste (los
// tokens fz-accent/fz-negative, no versiones pálidas) y tooltips reales con
// fecha/valor/porcentaje al pasar el mouse o tocar — el prototipo dibujaba
// los 3 gráficos "mudos" (solo SVG estático), acá usan Recharts con Tooltip.
// Click en una porción/leyenda de la torta filtra la lista por esa categoría
// (mismo mecanismo `categoryFilter`/`catFilter` del prototipo), implementado
// acá como navegación a la URL con `?categoria=`, reusando el filtro server-
// side que ya existía (Sesión J.1.15, TAREA 6) en vez de duplicar lógica de
// filtrado en el cliente.

const PIE_HUES = [175, 25, 300, 95, 250, 340, 60, 210];

interface CategorySlice {
  name: string;
  icon: string;
  amount: number;
}
interface MonthBar {
  label: string;
  gastos: number;
  ingresos: number;
}
interface LinePoint {
  label: string;
  value: number;
}

interface Props {
  currency: Currency;
  categoryData: CategorySlice[];
  monthlyComparativa: MonthBar[] | null;
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
  currency,
  categoryData,
  monthlyComparativa,
  cumulativeLine,
  activeCategory,
  currentParams,
}: Props) {
  const router = useRouter();
  const [chartType, setChartType] = useState<ChartType>("pie");
  const hasExtra = !!monthlyComparativa && !!cumulativeLine;

  if (categoryData.length === 0 && !hasExtra) return null;

  const pieData = [...categoryData]
    .sort((a, b) => b.amount - a.amount)
    .map((d, i) => ({ ...d, color: `oklch(0.58 0.15 ${PIE_HUES[i % PIE_HUES.length]})` }));
  const total = pieData.reduce((s, d) => s + d.amount, 0);

  function selectCategory(name: string) {
    const merged = { ...currentParams };
    const nextCategoria = activeCategory === name ? null : name;
    if (nextCategoria === null) delete merged.categoria;
    else merged.categoria = nextCategoria;
    const qs = new URLSearchParams(merged).toString();
    router.push(qs ? `/movimientos?${qs}` : "/movimientos");
  }

  const tabs: { key: ChartType; label: string }[] = [{ key: "pie", label: "Torta" }];
  if (hasExtra) tabs.push({ key: "bar", label: "Barras" }, { key: "line", label: "Línea" });

  return (
    <div className="bg-fz-surface border border-fz-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-xs font-medium text-fz-text-tertiary uppercase tracking-wide">
          {chartType === "pie" && `Gastos por categoría${currency !== "ARS" ? ` (${currency})` : ""}`}
          {chartType === "bar" && "Gastos vs. ingresos (ARS, 6 meses)"}
          {chartType === "line" && "Gasto acumulado del período (ARS)"}
        </p>
        {tabs.length > 1 && (
          <div className="flex bg-fz-surface-high rounded-lg p-0.5 gap-0.5 shrink-0">
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

      {chartType === "pie" && pieData.length > 0 && (
        <div className="flex items-center gap-4">
          <div style={{ width: 120, height: 120 }} className="shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={2}
                  stroke="none"
                  onClick={(d: { name?: string }) => d?.name && selectCategory(d.name)}
                  cursor="pointer"
                >
                  {pieData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.color}
                      opacity={activeCategory && activeCategory !== d.name ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const n = Number(value);
                    return [
                      `${formatCurrency(n, currency)} (${total ? Math.round((n / total) * 100) : 0}%)`,
                      String(name),
                    ];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            {pieData.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => selectCategory(d.name)}
                className="flex items-center gap-2 text-left"
                style={{ opacity: activeCategory && activeCategory !== d.name ? 0.4 : 1 }}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: d.color }}
                />
                <span className="flex-1 min-w-0 text-xs font-medium text-fz-text truncate">
                  {d.icon} {d.name}
                </span>
                <span className="text-[11px] font-mono font-semibold text-fz-text-secondary shrink-0">
                  {total ? Math.round((d.amount / total) * 100) : 0}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {chartType === "bar" && monthlyComparativa && (
        <>
          <div className="flex gap-4 mb-2 text-[11px] text-fz-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--fz-negative)" }} />
              Gastos
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--fz-accent)" }} />
              Ingresos
            </span>
          </div>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyComparativa} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--fz-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--fz-text-tertiary)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), "ARS")}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="gastos" fill="var(--fz-negative)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="ingresos" fill="var(--fz-accent)" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

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
