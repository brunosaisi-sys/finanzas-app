"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/format";

// TAREA 3a (Sesión J.1.16): el gráfico de evolución del portafolio que el
// prototipo de Claude Design calculaba (`invLinePts`/`invLinePath`,
// `buildLineChart`) pero nunca renderizaba en la pantalla de Inversiones —
// confirmado leyendo el .dc.html: esos valores solo se usaban dentro de la
// tarjeta "Resumen" de Inicio (`resumenIsInversiones`), nunca en `isInversiones`.
// TAREA 3b: mismos colores sólidos + tooltip real que TAREA 2b (interactivo,
// no un SVG mudo).

interface Point {
  date: string;
  label: string;
  value: number;
}

export default function InversionesChart({ points }: { points: Point[] }) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-fz-text-tertiary text-center py-10">
        Todavía no hay suficiente historial de precios para dibujar la evolución del período.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 160 }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--fz-border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--fz-text-tertiary)" }} axisLine={false} tickLine={false} />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            formatter={(value) => [formatCurrency(Number(value), "ARS"), "Valor"]}
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Valor"
            stroke="var(--fz-accent)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--fz-accent)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
