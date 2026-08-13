"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/format";

// Sesión J.1.17, TAREA 3/4: extraído de MovimientosCharts.tsx para reusar el
// mismo gráfico de barras (gastos vs. ingresos, 6 meses, solo ARS) en el
// resumen compacto de Inicio (TAREA 4) sin duplicar la lógica de render —
// funciona además como el "resumen de ingresos" pedido: gastos e ingresos
// mes a mes en un mismo gráfico, en vez de un stat aislado sin contexto.
export interface MonthBar {
  label: string;
  gastos: number;
  ingresos: number;
}

export default function MonthlyComparativaChart({ data }: { data: MonthBar[] }) {
  return (
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
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
  );
}
