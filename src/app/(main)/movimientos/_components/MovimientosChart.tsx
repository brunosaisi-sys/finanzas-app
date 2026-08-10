"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/types";

interface CategorySlice {
  name: string;
  icon: string;
  amount: number;
}

interface Props {
  data: CategorySlice[];
  currency: Currency;
}

// Gráfico mínimo viable (Sesión J.1.14, TAREA 8b): barras horizontales por
// categoría — más legible que un gráfico de torta en pantallas angostas (los
// nombres de categoría no se cortan, no hace falta leyenda aparte).
export default function MovimientosChart({ data, currency }: Props) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.amount - a.amount);
  const chartData = sorted.map((d) => ({ name: `${d.icon} ${d.name}`, amount: d.amount }));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
        Gastos por categoría {currency !== "ARS" && `(${currency})`}
      </p>
      <div style={{ width: "100%", height: Math.max(100, chartData.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value), currency)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="amount" fill="#111827" radius={[0, 6, 6, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
