"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

// Sesión J.1.17, TAREA 3/4: extraído de MovimientosCharts.tsx para reusar el
// mismo gráfico de torta (paleta fija, tooltip real, click filtra) en el
// resumen compacto de Inicio (TAREA 4) sin duplicar la lógica de render.
export const CHART_PALETTE = [
  "oklch(0.62 0.13 175)", // teal
  "oklch(0.58 0.19 260)", // azul
  "oklch(0.60 0.19 310)", // violeta
  "oklch(0.68 0.16 55)", // ámbar
  "oklch(0.58 0.19 20)", // rojo
  "oklch(0.62 0.14 145)", // verde
  "oklch(0.60 0.18 340)", // magenta
  "oklch(0.55 0.10 230)", // azul grisáceo
];

export interface CategorySlice {
  name: string;
  icon: string;
  amount: number;
}

interface Props {
  data: CategorySlice[];
  currency: Currency;
  activeCategory: string | null;
  onSelect: (name: string) => void;
}

export default function CategoryPieChart({ data, currency, activeCategory, onSelect }: Props) {
  const pieData = [...data]
    .sort((a, b) => b.amount - a.amount)
    .map((d, i) => ({ ...d, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  const total = pieData.reduce((s, d) => s + d.amount, 0);

  if (pieData.length === 0) return null;

  return (
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
              onClick={(d: { name?: string }) => d?.name && onSelect(d.name)}
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
            onClick={() => onSelect(d.name)}
            className="flex items-center gap-2 text-left"
            style={{ opacity: activeCategory && activeCategory !== d.name ? 0.4 : 1 }}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
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
  );
}
